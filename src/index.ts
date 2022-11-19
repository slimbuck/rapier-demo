import { View } from './view';
import { World } from './world';
import RAPIER from '@dimforge/rapier3d-compat';

const preInitPromises = [
    RAPIER.init()
];

Promise.all(preInitPromises).then((results) => {
    const WORLD = new World();
    const VIEW = new View(document.getElementById("app"), WORLD);

    WORLD.init();
});
