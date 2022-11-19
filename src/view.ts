
import {
    Application,
    Mouse,
    TouchDevice,
    RESOLUTION_AUTO,
    GAMMA_SRGB,
    Color,
    Entity,
    Vec3,
    FILLMODE_NONE,
    Texture,
    FILTER_NEAREST,
    ADDRESS_CLAMP_TO_EDGE,
    PIXELFORMAT_R8_G8_B8_A8,
    PIXELFORMAT_DEPTH,
    RenderTarget,
    WebglGraphicsDevice
} from 'playcanvas';
import { OrbitController } from './orbit-controller.js';
import { World, WorldEntity, WorldFrame } from './world.js';

interface Vector3 {
    x: number;
    y: number;
    z: number;
};

interface Vector4 {
    x: number;
    y: number;
    z: number;
    w: number;
};

//-- helpers

const lerp = (a: number, b: number, t: number) => a * (1.0 - t) + b * t;

const lerpVec3 = (a: Vector3, b: Vector3, t: number): Vector3 => {
    return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        z: lerp(a.z, b.z, t)
    };
};

const lerpVec4 = (a: Vector4, b: Vector4, t: number): Vector4 => {
    return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        z: lerp(a.z, b.z, t),
        w: lerp(a.w, b.w, t)
    };
};

class View {
    canvas: HTMLCanvasElement;
    world: World;
    time = 0;
    physicsFrames: WorldFrame[];
    physicsObjects: any;
    settings = {
        multisample: true,
        pixelScale: 1.0
    };
    app: Application;
    camera: Entity;
    light: Entity;
    ground: Entity;
    orbitController: OrbitController;

    constructor(dom: HTMLElement, world: World) {
        this.canvas = document.createElement('canvas');
        dom.appendChild(this.canvas);

        // store the world
        this.world = world;

        this.physicsFrames = [null, null];
        this.physicsObjects = {};

        this.world.on('added', (details) => this.onAdded(details));
        this.world.on('removed', (details) => this.onRemoved(details));
        this.world.on('update', (details) => this.onUpdate(details));

        // create the app
        this.app = new Application(this.canvas, {
            mouse: new Mouse(this.canvas),
            touch: new TouchDevice(this.canvas),
            graphicsDeviceOptions: {
                preferWebGl2: true,
                alpha: true,
                antialias: false,
                depth: false,
                preserveDrawingBuffer: true
            }
        });
        this.app.setCanvasResolution(RESOLUTION_AUTO);
        this.app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;
        this.app.scene.gammaCorrection = GAMMA_SRGB;

        this.app.on('update', (deltaTime) => this.update(deltaTime));
        this.app.on('postrender', () => this.onPostRender());

        // create the camera
        this.camera = new Entity("Camera");
        this.camera.addComponent("camera", {
            fov: 75,
            clearColor: new Color(0.4, 0.45, 0.5),
            frustumCulling: true
        });
        this.app.root.addChild(this.camera);

        // create the light
        this.light = new Entity();
        this.light.addComponent("light", {
            type: "directional",
            color: new Color(1.05, 1.0, 0.95),
            castShadows: true,
            intensity: 1,
            shadowBias: 0.2,
            shadowDistance: 20,
            normalOffsetBias: 0.05,
            shadowResolution: 2048
        });
        this.light.setLocalEulerAngles(45, 30, 0);
        this.app.root.addChild(this.light);

        // ambient light
        this.app.scene.ambientLight.set(0.1, 0.15, 0.2);

        // create the ground plane
        this.ground = new Entity();
        this.ground.addComponent("render", {
            type: "plane"
        });
        this.ground.setLocalScale(15, 1, 15);
        this.ground.setPosition(0, 0.1, 0);
        this.app.root.addChild(this.ground);

        // initialize orbit controls
        this.orbitController = new OrbitController(this.camera, this.app.mouse, this.app.touch);
        this.orbitController.focalPoint.snapto(new Vec3(0, 1, 0));

        // configure render canvas
        window.addEventListener("resize", () => {
            this.resizeCanvas();
        });
        this.resizeCanvas();

        // start the application
        this.app.start();
    }

    getCanvasSize() {
        return {
            width: document.body.clientWidth,
            height: document.body.clientHeight
        };
    }

    resizeCanvas() {
        const canvasSize = this.getCanvasSize();
        this.app.setCanvasFillMode(FILLMODE_NONE, canvasSize.width, canvasSize.height);
        
        const device = this.app.graphicsDevice as WebglGraphicsDevice;
        const createTexture = (width: number, height: number, format: number) => {
            return new Texture(device, {
                width: width,
                height: height,
                format: format,
                mipmaps: false,
                minFilter: FILTER_NEAREST,
                magFilter: FILTER_NEAREST,
                addressU: ADDRESS_CLAMP_TO_EDGE,
                addressV: ADDRESS_CLAMP_TO_EDGE
            });
        };

        // out with the old
        const old = this.camera.camera.renderTarget;
        if (old) {
            old.colorBuffer.destroy();
            old.depthBuffer.destroy();
            old.destroy();
        }

        // in with the new
        const w = Math.floor(canvasSize.width * window.devicePixelRatio / this.settings.pixelScale);
        const h = Math.floor(canvasSize.height * window.devicePixelRatio / this.settings.pixelScale);
        const colorBuffer = createTexture(w, h, PIXELFORMAT_R8_G8_B8_A8);
        const depthBuffer = createTexture(w, h, PIXELFORMAT_DEPTH);
        const renderTarget = new RenderTarget({
            colorBuffer: colorBuffer,
            depthBuffer: depthBuffer,
            flipY: false,
            samples: this.settings.multisample ? device.maxSamples : 1,
            autoResolve: false
        });
        this.camera.camera.renderTarget = renderTarget;
    }

    update(deltaTime: number) {
        this.time += deltaTime;

        while (this.world.time < this.time) {
            this.world.step();
        }

        this.resolvePhysics();

        this.orbitController.update(deltaTime);
    }

    onPostRender() {
        const device = this.app.graphicsDevice as WebglGraphicsDevice;

        if (this.camera.camera.renderTarget._samples > 1) {
            this.camera.camera.renderTarget.resolve();
        }

        // copy render target
        device.copyRenderTarget(this.camera.camera.renderTarget, null, true, false);

        // activate the back buffer
        device.setRenderTarget(null);
        device.updateBegin();
        device.setViewport(0, 0, device.width, device.height);
        device.setScissor(0, 0, device.width, device.height);
    }

    onAdded(details: WorldEntity) {
        const entity = new Entity(`physics-${details.id}`);
        if (details.type === 'cuboid') {
            entity.addComponent('render', {
                type: 'box'
            });
            entity.setLocalScale(details.size.x * 2, details.size.y * 2, details.size.z * 2);
        }
        entity.setPosition(details.position.x, details.position.y, details.position.z);
        this.app.root.addChild(entity);
        this.physicsObjects[details.id] = entity;
    }

    onRemoved(details: any) {

    }

    onUpdate(frame: WorldFrame) {
        // store the new frame
        this.physicsFrames[0] = this.physicsFrames[1];
        this.physicsFrames[1] = frame;
    }

    // given two physics frames, interpolate the view frame
    resolvePhysics() {
        const frames = this.physicsFrames;
        if (!frames[0] || !frames[1]) {
            return;
        }

        const d = (this.time - frames[0].time) / (frames[1].time - frames[0].time);

        const ids = Object.keys(frames[1].bodies);
        ids.forEach((id) => {
            const entity = this.physicsObjects[id];
            if (entity) {
                // @ts-ignore
                const frame1 = frames[1].bodies[id];
                if (frame1) {
                    // @ts-ignore
                    const frame0 = frames[0].bodies[id];

                    let p, r;
                    if (frame0) {
                        p = lerpVec3(frame0.position, frame1.position, d);
                        r = lerpVec4(frame0.rotation, frame1.rotation, d);
                    } else {
                        p = frame1.position;
                        r = frame1.rotation;
                    }
                    entity.setPosition(p.x, p.y, p.z);
                    entity.setRotation(r.x, r.y, r.z, r.w);
                }
            }
        });
    }
}

export { View };
