import * as pc from 'playcanvas';

class World extends pc.EventHandler {
    constructor(RAPIER) {
        super();

        this.RAPIER = RAPIER;

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
        this.createBox(1, 4, 1, 1, 1, 1);
    }

    createBox(px, py, pz, sx, sy, sz) {
        // Create a dynamic rigid-body.
        const rigidBodyDesc = this.RAPIER.RigidBodyDesc.dynamic()
            .setTranslation(px, py, pz);
        this.rigidBody = this.world.createRigidBody(rigidBodyDesc);

        // Create a cuboid collider attached to the dynamic rigidBody.
        const colliderDesc = this.RAPIER.ColliderDesc.cuboid(sx, sy, sz);
        const collider = this.world.createCollider(colliderDesc, this.rigidBody);

        this.bodies.push(this.rigidBody);

        this.fire('added', {
            id: this.rigidBody.handle,
            type: 'cuboid',
            position: { x: px, y: py, z: pz },
            size: { x: sx, y: sy, z: sz }
        });
    }

    step(deltaTime) {
        this.world.step();
        this.time += this.world.integrationParameters.dt;

        const bodies = {};
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
    World
};
