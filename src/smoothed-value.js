const Interp = {
    sinosidal: (n) => Math.sin(n * Math.PI / 2.0),
    quadratic: (n) => n * (2 - n),
    quartic: (n) => 1 - --n * n * n * n,
    quintic: (n) => Math.pow(n - 1, 5) + 1
};

// control a smoothed value
// value type must support clone, copy and lerp functions
class SmoothedValue {
    value;
    start;
    target;
    transitionTime;
    timer;

    constructor(value, transitionTime = 0.25) {
        this.value = value.clone();
        this.start = value.clone();
        this.target = value.clone();
        this.transitionTime = transitionTime;
        this.timer = 0;
    }

    goto(target) {
        this.timer = 0;
        this.start.copy(this.value);
        this.target.copy(target);
    }

    snapto(value) {
        this.timer = this.transitionTime;
        this.target.copy(value);
    }

    update(deltaTime) {
        if (this.timer < this.transitionTime) {
            this.timer = Math.min(this.timer + deltaTime, this.transitionTime);
            this.value.lerp(this.start, this.target, Interp.quintic(this.timer / this.transitionTime));
        } else {
            this.value.copy(this.target);
        }
    }
}

export {
    SmoothedValue
};
