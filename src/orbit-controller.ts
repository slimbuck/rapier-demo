import * as pc from 'playcanvas';
import { SmoothedValue } from './smoothed-value.js';

const vec = new pc.Vec3();
const fromWorldPoint = new pc.Vec3();
const toWorldPoint = new pc.Vec3();
const worldDiff = new pc.Vec3();

class OrbitController {
    cameraEntity: pc.Entity;
    focalPoint: SmoothedValue<pc.Vec3>;
    azimElevDistance: SmoothedValue<pc.Vec3>;
    mouseController: MouseController;
    touchController: TouchController;

    constructor(cameraEntity: pc.Entity, mouse: pc.Mouse, touch: pc.TouchDevice, transitionTime=0.25) {
        this.cameraEntity = cameraEntity;
        this.focalPoint = new SmoothedValue(new pc.Vec3(0, 0, 0), transitionTime);
        this.azimElevDistance = new SmoothedValue(new pc.Vec3(0, 0, 2), transitionTime);
        this.mouseController = mouse && new MouseController(mouse, this);
        this.touchController = touch && new TouchController(touch, this);
    }

    destroy() {
        this.mouseController && this.mouseController.destroy();
        this.touchController && this.touchController.destroy();
    }

    vecToAzimElevDistance(vec: pc.Vec3, azimElevDistance: pc.Vec3) {
        const distance = vec.length();
        const azim = Math.atan2(-vec.x / distance, -vec.z / distance) * pc.math.RAD_TO_DEG;
        const elev = Math.asin(vec.y / distance) * pc.math.RAD_TO_DEG;
        azimElevDistance.set(azim, elev, distance);
    }

    // calculate the current forward vector
    calcForwardVec(result: pc.Vec3) {
        const ex = this.azimElevDistance.value.y * pc.math.DEG_TO_RAD;
        const ey = this.azimElevDistance.value.x * pc.math.DEG_TO_RAD;
        const s1 = Math.sin(-ex);
        const c1 = Math.cos(-ex);
        const s2 = Math.sin(-ey);
        const c2 = Math.cos(-ey);
        result.set(-c1 * s2, s1, c1 * c2);
    }

    update(deltaTime: number) {
        // update underlying values
        this.focalPoint.update(deltaTime);
        this.azimElevDistance.update(deltaTime);

        const aed = this.azimElevDistance.value;
        this.calcForwardVec(vec);
        vec.mulScalar(aed.z);
        vec.add(this.focalPoint.value);

        this.cameraEntity.setLocalPosition(vec);
        this.cameraEntity.setLocalEulerAngles(aed.y, aed.x, 0);
    }
}

// MouseController

class MouseController {
    mouse: pc.Mouse;
    orbitController: OrbitController;
    orbitSensitivity = 0.3;
    distanceSensitivity = 0.4;
    lookButtonDown = false;
    panButtonDown = false;
    lastPoint = new pc.Vec2();

    onMouseOutFunc = () => {
        this.onMouseOut();
    };

    constructor(mouse: pc.Mouse, orbitController: OrbitController) {
        this.mouse = mouse;
        this.orbitController = orbitController;

        this.mouse.on(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
        this.mouse.on(pc.EVENT_MOUSEUP, this.onMouseUp, this);
        this.mouse.on(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
        this.mouse.on(pc.EVENT_MOUSEWHEEL, this.onMouseWheel, this);

        // Listen to when the mouse travels out of the window
        window.addEventListener('mouseout', this.onMouseOutFunc, false);

        // Disabling the context menu stops the browser displaying a menu when
        // you right-click the page
        this.mouse.disableContextMenu();
    }

    destroy() {
        this.mouse.off(pc.EVENT_MOUSEDOWN, this.onMouseDown, this);
        this.mouse.off(pc.EVENT_MOUSEUP, this.onMouseUp, this);
        this.mouse.off(pc.EVENT_MOUSEMOVE, this.onMouseMove, this);
        this.mouse.off(pc.EVENT_MOUSEWHEEL, this.onMouseWheel, this);

        window.removeEventListener('mouseout', this.onMouseOutFunc, false);
    }

    pan(screenPoint: pc.MouseEvent) {
        // For panning to work at any zoom level, we use screen point to world projection
        // to work out how far we need to pan the pivotEntity in world space
        const camera = this.orbitController.cameraEntity.camera;
        const distance = this.orbitController.azimElevDistance.value.z;

        camera.screenToWorld(screenPoint.x, screenPoint.y, distance, fromWorldPoint);
        camera.screenToWorld(this.lastPoint.x, this.lastPoint.y, distance, toWorldPoint);

        worldDiff.sub2(toWorldPoint, fromWorldPoint);
        worldDiff.add(this.orbitController.focalPoint.target);

        this.orbitController.focalPoint.goto(worldDiff);
    }


    onMouseDown(event: pc.MouseEvent) {
        switch (event.button) {
            case pc.MOUSEBUTTON_LEFT:
                this.lookButtonDown = true;
                break;
            case pc.MOUSEBUTTON_MIDDLE:
            case pc.MOUSEBUTTON_RIGHT:
                this.panButtonDown = true;
                break;
        }
    }

    onMouseUp(event: pc.MouseEvent) {
        switch (event.button) {
            case pc.MOUSEBUTTON_LEFT:
                this.lookButtonDown = false;
                break;
            case pc.MOUSEBUTTON_MIDDLE:
            case pc.MOUSEBUTTON_RIGHT:
                this.panButtonDown = false;
                break;
        }
    }

    onMouseMove(event: pc.MouseEvent) {
        if (this.lookButtonDown) {
            vec.copy(this.orbitController.azimElevDistance.target);
            vec.y -= event.dy * this.orbitSensitivity;
            vec.x -= event.dx * this.orbitSensitivity;
            this.orbitController.azimElevDistance.goto(vec);
        } else if (this.panButtonDown) {
            this.pan(event);
        }

        this.lastPoint.set(event.x, event.y);
    }

    onMouseWheel(event: pc.MouseEvent) {
        vec.copy(this.orbitController.azimElevDistance.target);
        vec.z -= event.wheelDelta * -2 * this.distanceSensitivity * (vec.z * 0.1);
        this.orbitController.azimElevDistance.goto(vec);
        event.event.preventDefault();
    }

    onMouseOut() {
        this.lookButtonDown = false;
        this.panButtonDown = false;
    }
}

// TouchController

class TouchController {
    touch: pc.TouchDevice;
    orbitContoller: OrbitController;
    orbitSensitivity = 0.3;
    distanceSensitivity = 0.4;
    lastTouchPoint = new pc.Vec2();
    lastPinchMidPoint = new pc.Vec2();
    lastPinchDistance = 0;
    pinchMidPoint = new pc.Vec2();

    constructor(touch: pc.TouchDevice, orbitContoller: OrbitController) {
        this.touch = touch;
        this.orbitContoller = orbitContoller;

        // Use the same callback for the touchStart, touchEnd and touchCancel events as they
        // all do the same thing which is to deal the possible multiple touches to the screen
        this.touch.on(pc.EVENT_TOUCHSTART, this.onTouchStartEndCancel, this);
        this.touch.on(pc.EVENT_TOUCHEND, this.onTouchStartEndCancel, this);
        this.touch.on(pc.EVENT_TOUCHCANCEL, this.onTouchStartEndCancel, this);
        this.touch.on(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);
    }

    destroy() {
        this.touch.off(pc.EVENT_TOUCHSTART, this.onTouchStartEndCancel, this);
        this.touch.off(pc.EVENT_TOUCHEND, this.onTouchStartEndCancel, this);
        this.touch.off(pc.EVENT_TOUCHCANCEL, this.onTouchStartEndCancel, this);
        this.touch.off(pc.EVENT_TOUCHMOVE, this.onTouchMove, this);
    }

    getPinchDistance(pointA: pc.Touch, pointB: pc.Touch) {
        // Return the distance between the two points
        const dx = pointA.x - pointB.x;
        const dy = pointA.y - pointB.y;
        return Math.sqrt((dx * dx) + (dy * dy));
    }

    calcMidPoint(pointA: pc.Touch, pointB: pc.Touch, result: pc.Vec2) {
        result.set(pointB.x - pointA.x, pointB.y - pointA.y);
        result.mulScalar(0.5);
        result.x += pointA.x;
        result.y += pointA.y;
    }

    onTouchStartEndCancel(event: pc.TouchEvent) {
        // We only care about the first touch for camera rotation. As the user touches the screen,
        // we stored the current touch position
        const touches = event.touches;
        if (touches.length === 1) {
            this.lastTouchPoint.set(touches[0].x, touches[0].y);
        } else if (touches.length === 2) {
            // If there are 2 touches on the screen, then set the pinch distance
            this.lastPinchDistance = this.getPinchDistance(touches[0], touches[1]);
            this.calcMidPoint(touches[0], touches[1], this.lastPinchMidPoint);
        }
    }

    pan(midPoint: pc.Vec2) {
        // For panning to work at any zoom level, we use screen point to world projection
        // to work out how far we need to pan the pivotEntity in world space
        const camera = this.orbitContoller.cameraEntity.camera;
        const distance = this.orbitContoller.azimElevDistance.target.z;

        camera.screenToWorld(midPoint.x, midPoint.y, distance, fromWorldPoint);
        camera.screenToWorld(this.lastPinchMidPoint.x, this.lastPinchMidPoint.y, distance, toWorldPoint);

        worldDiff.sub2(toWorldPoint, fromWorldPoint);
        worldDiff.add(this.orbitContoller.focalPoint.target);

        this.orbitContoller.focalPoint.goto(worldDiff);
    }

    onTouchMove(event: pc.TouchEvent) {
        const pinchMidPoint = this.pinchMidPoint;

        const aed = this.orbitContoller.azimElevDistance.target.clone();

        // We only care about the first touch for camera rotation. Work out the difference moved since the last event
        // and use that to update the camera target position
        const touches = event.touches;
        if (touches.length === 1) {
            const touch = touches[0];
            aed.y -= (touch.y - this.lastTouchPoint.y) * this.orbitSensitivity;
            aed.x -= (touch.x - this.lastTouchPoint.x) * this.orbitSensitivity;
            this.orbitContoller.azimElevDistance.goto(aed);
            this.lastTouchPoint.set(touch.x, touch.y);
        } else if (touches.length === 2) {
            // Calculate the difference in pinch distance since the last event
            const currentPinchDistance = this.getPinchDistance(touches[0], touches[1]);
            const diffInPinchDistance = currentPinchDistance - this.lastPinchDistance;
            this.lastPinchDistance = currentPinchDistance;

            aed.z -= (diffInPinchDistance * this.distanceSensitivity * 0.1) * (aed.z * 0.1);
            this.orbitContoller.azimElevDistance.goto(aed);

            // Calculate pan difference
            this.calcMidPoint(touches[0], touches[1], pinchMidPoint);
            this.pan(pinchMidPoint);
            this.lastPinchMidPoint.copy(pinchMidPoint);
        }
    }
}

export {
    OrbitController
};
