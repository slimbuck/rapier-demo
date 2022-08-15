// interpolation functions
const Interp = {
    sinosidal: (n: number) => Math.sin(n * Math.PI / 2.0),
    quadratic: (n: number) => n * (2 - n),
    quartic: (n: number) => 1 - --n * n * n * n,
    quintic: (n: number) => Math.pow(n - 1, 5) + 1
};

// smoothed values must implement the following interface
interface SmoothedValueType<T> {
    clone(): T;
    copy(value: T): T;
    lerp(a: T, b: T, t: number): T;
};

// control a smoothed value
class SmoothedValue<T extends SmoothedValueType<T> > {
    value: T;
    start: T;
    target: T;
    transitionTime: number;
    timer: number;

    constructor(value: T, transitionTime = 0.25) {
        this.value = value.clone();
        this.start = value.clone();
        this.target = value.clone();
        this.transitionTime = transitionTime;
        this.timer = 0;
    }

    goto(target: T) {
        this.timer = 0;
        this.start.copy(this.value);
        this.target.copy(target);
    }

    snapto(value: T) {
        this.timer = this.transitionTime;
        this.target.copy(value);
    }

    update(deltaTime: number) {
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
