
import * as pc from 'playcanvas';
import { OrbitController } from './orbit-controller.js';

//-- helpers

const lerp = (a, b, t) => a * (1.0 - t) + b * t;

const lerpVec3 = (a, b, t) => {
    return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        z: lerp(a.z, b.z, t)
    };
};

const lerpVec4 = (a, b, t) => {
    return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        z: lerp(a.z, b.z, t),
        w: lerp(a.w, b.w, t)
    };
};

class View {
    constructor(dom, world) {
        this.canvas = document.createElement('canvas');
        dom.appendChild(this.canvas);

        // store the world
        this.world = world;
        this.time = 0;

        this.physicsFrames = [null, null];
        this.physicsObjects = {};

        this.world.on('added', (details) => this.onAdded(details));
        this.world.on('removed', (details) => this.onRemoved(details));
        this.world.on('update', (details) => this.onUpdate(details));

        // construct the view settings object
        this.settings = {
            multisample: true,
            pixelScale: 1.0
        };

        // create the app
        this.app = new pc.Application(this.canvas, {
            mouse: new pc.Mouse(this.canvas),
            touch: new pc.TouchDevice(this.canvas),
            graphicsDeviceOptions: {
                preferWebGl2: true,
                alpha: true,
                antialias: false,
                depth: false,
                preserveDrawingBuffer: true
            }
        });
        this.app.setCanvasResolution(pc.RESOLUTION_AUTO);
        this.app.graphicsDevice.maxPixelRatio = window.devicePixelRatio;
        this.app.scene.gammaCorrection = pc.GAMMA_SRGB;

        this.app.on('update', (deltaTime) => this.update(deltaTime));
        this.app.on('postrender', () => this.onPostRender());

        // create the camera
        this.camera = new pc.Entity("Camera");
        this.camera.addComponent("camera", {
            fov: 75,
            clearColor: new pc.Color(0.4, 0.45, 0.5),
            frustumCulling: true
        });
        this.app.root.addChild(this.camera);

        // create the light
        this.light = new pc.Entity();
        this.light.addComponent("light", {
            type: "directional",
            color: new pc.Color(1.05, 1.0, 0.95),
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
        this.ground = new pc.Entity();
        this.ground.addComponent("render", {
            type: "plane"
        });
        this.ground.setLocalScale(15, 1, 15);
        this.ground.setPosition(0, 0.1, 0);
        this.app.root.addChild(this.ground);

        // initialize orbit controls
        this.orbitController = new OrbitController(this.camera, this.app.mouse, this.app.touch);
        this.orbitController.focalPoint.snapto(new pc.Vec3(0, 1, 0));

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
        this.app.setCanvasFillMode(pc.FILLMODE_NONE, canvasSize.width, canvasSize.height);
        
        const device = this.app.graphicsDevice;
        const createTexture = (width, height, format) => {
            return new pc.Texture(device, {
                width: width,
                height: height,
                format: format,
                mipmaps: false,
                minFilter: pc.FILTER_NEAREST,
                magFilter: pc.FILTER_NEAREST,
                addressU: pc.ADDRESS_CLAMP_TO_EDGE,
                addressV: pc.ADDRESS_CLAMP_TO_EDGE
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
        const colorBuffer = createTexture(w, h, pc.PIXELFORMAT_R8_G8_B8_A8);
        const depthBuffer = createTexture(w, h, pc.PIXELFORMAT_DEPTH);
        const renderTarget = new pc.RenderTarget({
            colorBuffer: colorBuffer,
            depthBuffer: depthBuffer,
            flipY: false,
            samples: this.settings.multisample ? device.maxSamples : 1,
            autoResolve: false
        });
        this.camera.camera.renderTarget = renderTarget;
    }

    update(deltaTime) {
        this.time += deltaTime;

        while (this.world.time < this.time) {
            this.world.step();
        }

        this.resolvePhysics();

        this.orbitController.update(deltaTime);
    }

    onPostRender() {
        if (this.camera.camera.renderTarget._samples > 1) {
            this.camera.camera.renderTarget.resolve();
        }

        // copy render target
        this.app.graphicsDevice.copyRenderTarget(this.camera.camera.renderTarget, null, true, false);

        // activate the back buffer
        const device = this.app.graphicsDevice;
        device.setRenderTarget(null);
        device.updateBegin();
        device.setViewport(0, 0, device.width, device.height);
        device.setScissor(0, 0, device.width, device.height);
    }

    onAdded(details) {
        const entity = new pc.Entity(`physics-${details.id}`);
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

    onRemoved(details) {

    }

    onUpdate(frame) {
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
                const frame1 = frames[1].bodies[id];
                if (frame1) {
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
