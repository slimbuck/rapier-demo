import { View } from './view';
import { World } from './world';
import RAPIER from '@dimforge/rapier3d-compat';

const preInitPromises = [
    RAPIER.init()
];

Promise.all(preInitPromises).then((results) => {
    // const RAPIER = results[0];
    const WORLD = new World(RAPIER);
    const VIEW = new View(document.getElementById("app"), WORLD);

    WORLD.init();
});
