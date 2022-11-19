import {
    EventHandler
} from 'playcanvas';
import RAPIER from '@dimforge/rapier3d-compat';

interface WorldFrame {
    time: number;
    bodies: any[];
};

interface WorldEntity {
    id: number;
    type: string;
    position: { x: number, y: number, z: number },
    size: { x: number, y: number, z: number }
}

class World extends EventHandler {
    world: RAPIER.World;
    time = 0;
    bodies: RAPIER.RigidBody[];

    constructor() {
        super();

        // Use the RAPIER module here.
        const gravity = { x: 0.0, y: -9.81, z: 0.0 };
        this.world = new RAPIER.World(gravity);
        this.time = 0;

        // Create the ground
        const groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 0.1, 10.0);
        this.world.createCollider(groundColliderDesc);

        this.bodies = [];
    }

    init() {
        this.createBox(0, 2, 0, 0.5, 0.5, 0.5);
        this.createBox(1.25, 4, -1.25, 1, 1, 1);
        this.createBox(-1.25, 4, -1.25, 1, 1, 1);
    }

    createBox(px: number, py: number, pz: number, sx: number, sy: number, sz: number) {
        // Create a dynamic rigid-body.
        const rigidBodyDesc = RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(px, py, pz);
        const rigidBody = this.world.createRigidBody(rigidBodyDesc);

        // Create a cuboid collider attached to the dynamic rigidBody.
        const colliderDesc = RAPIER.ColliderDesc.cuboid(sx, sy, sz);
        const collider = this.world.createCollider(colliderDesc, rigidBody);

        this.bodies.push(rigidBody);

        this.fire('added', {
            id: rigidBody.handle,
            type: 'cuboid',
            position: { x: px, y: py, z: pz },
            size: { x: sx, y: sy, z: sz }
        });
    }

    step() {
        this.world.step();
        this.time += this.world.integrationParameters.dt;

        const bodies: any = {};
        this.bodies.forEach((body) => {
            bodies[body.handle] = {
                position: body.translation(),
                rotation: body.rotation()
            }
        });

        this.fire('update', {
            time: this.time,
            bodies: bodies
        });
    }
}

export {
    World,
    WorldFrame,
    WorldEntity
};
