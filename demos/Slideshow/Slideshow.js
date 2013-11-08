var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var AnimationType;
(function (AnimationType) {
    AnimationType[AnimationType["ENTRANCE"] = 0] = "ENTRANCE";
    AnimationType[AnimationType["EMPHASIS"] = 1] = "EMPHASIS";
    AnimationType[AnimationType["EXIT"] = 2] = "EXIT";
})(AnimationType || (AnimationType = {}));

var AnimationState;
(function (AnimationState) {
    AnimationState[AnimationState["PLAYING"] = 0] = "PLAYING";
    AnimationState[AnimationState["PAUSED"] = 1] = "PAUSED";
})(AnimationState || (AnimationState = {}));

/**
* Singleton class. Manages all of the animation types.
*/
var AnimationManager = (function () {
    function AnimationManager() {
    }
    AnimationManager.GetDB = function (type) {
        var db;
        switch (type) {
            case AnimationType.ENTRANCE:
                db = AnimationManager.EntranceAnimations;
                break;
            case AnimationType.EMPHASIS:
                db = AnimationManager.EmphasisAnimations;
                break;
            case AnimationType.EXIT:
                db = AnimationManager.ExitAnimations;
                break;
        }
        return db;
    };

    AnimationManager.RegisterAnimation = function (type, anim) {
        var db = AnimationManager.GetDB(type);
        if (db.hasOwnProperty(anim.title)) {
            throw new Error("Animation already defined: " + anim.title);
        }
        db[anim.title] = anim;
    };

    AnimationManager.GetAnimation = function (type, name) {
        var db = AnimationManager.GetDB(type);
        if (!db.hasOwnProperty(name)) {
            throw new Error("Animation not defined: " + name);
        }
        return db[name];
    };
    AnimationManager.EntranceAnimations = {};
    AnimationManager.EmphasisAnimations = {};
    AnimationManager.ExitAnimations = {};
    return AnimationManager;
})();

var Animation = (function () {
    function Animation(type, pic, canvas, finishedCb, duration, interval) {
        if (typeof duration === "undefined") { duration = 5000; }
        if (typeof interval === "undefined") { interval = 50; }
        this.type = type;
        this.pic = pic;
        this.canvas = canvas;
        this.finishedCb = finishedCb;
        this.duration = duration;
        this.interval = interval;
        this.intervalId = -1;
        this.ctx = this.canvas.getContext("2d");
        this.reset();

        var _this = this;
        this.animationStepLambda = function () {
            _this.timeElapsed += _this.interval;
            _this.animationStep();
            _this.draw();

            if (_this.timeElapsed >= _this.duration) {
                _this.reset();
                _this.finishedCb();
            }
        };
    }
    Animation.Create = /**
    * Factory methods for creating animations.
    */
    function (type, pic, info, canvas, finishedCb) {
        var cons = AnimationManager.GetAnimation(type, info.type);
        return new cons(pic, info, canvas, finishedCb);
    };

    /**
    * Abstract method: Should be overridden by child classes. Advances the
    * animation by one step, and draws the updated animation to the canvas.
    */
    Animation.prototype.animationStep = function () {
        throw new Error("Animation is an abstract class and does not implement animationStep.");
    };

    /**
    * Abstract method.
    * Draws the current frame of the animation.
    * Invariants:
    * - Does not mutate Animation state!
    * - Leave No Trace on the canvas:
    *     Reset any properties set for drawing to their previous state.
    */
    Animation.prototype.draw = function () {
        throw new Error("Animation is an abstract class and does not implement draw.");
    };

    Animation.prototype.startInterval = function () {
        this.intervalId = setInterval(this.animationStepLambda, this.interval);
    };

    Animation.prototype.stopInterval = function () {
        if (this.intervalId > -1) {
            clearInterval(this.intervalId);
            this.intervalId = -1;
        }
    };

    /**
    * Resumes playback of the animation from its current state.
    */
    Animation.prototype.play = function () {
        this.startInterval();
    };

    /**
    * Pauses animation playback.
    */
    Animation.prototype.pause = function () {
        this.stopInterval();
    };

    /**
    * Resets all mutable state in the animation to its starting default state.
    * Does not touch the canvas.
    */
    Animation.prototype.reset = function () {
        this.stopInterval();
        this.timeElapsed = 0;
    };

    /**
    * Sets the canvas to be completely transparent.
    */
    Animation.prototype.clearCanvas = function () {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    };

    /**
    * Draws the unmodified image on the canvas.
    */
    Animation.prototype.drawRawImage = function () {
        this.clearCanvas();
        this.ctx.drawImage(this.pic, 0, 0);
    };

    /**
    * Draws the expected start state of the canvas. Ensures that the canvas is
    * in an appropriate state to proceed with the animation.
    *
    * This also pauses the animation if it is currently playing.
    *
    * The start state differs depending on the animation type:
    * - ENTRANCE: Transparent.
    * - EMPHASIS: The raw picture.
    * - EXIT: Transparent.
    */
    Animation.prototype.skipToStart = function () {
        this.pause();
        this.reset();
        switch (this.type) {
            case AnimationType.ENTRANCE:
                return this.clearCanvas();
            case AnimationType.EMPHASIS:
                return this.drawRawImage();
            case AnimationType.EXIT:
                return this.drawRawImage();
        }
    };
    return Animation;
})();

function standardize(info, defaultOptions) {
    if (!info.hasOwnProperty('options')) {
        info.options = {};
    }
    for (var prop in defaultOptions) {
        if (!defaultOptions.hasOwnProperty(prop)) {
            continue;
        }
        info.options[prop] = defaultOptions[prop];
    }
}

var Fade = (function (_super) {
    __extends(Fade, _super);
    function Fade(type, pic, animInfo, canvas, finishedCb) {
        standardize(animInfo, { duration: 2000 });
        _super.call(this, type, pic, canvas, finishedCb, animInfo.options['duration']);

        // Default to fade in.
        this.alphaDelta = 1 / (this.duration / this.interval);
        this.startAlpha = 0;
        this.alpha = 0;
    }
    Fade.prototype.reset = function () {
        _super.prototype.reset.call(this);
        this.alpha = this.startAlpha;
    };

    Fade.prototype.animationStep = function () {
        this.alpha += this.alphaDelta;
    };

    Fade.prototype.draw = function () {
        var prevAlpha = this.ctx.globalAlpha;
        this.ctx.globalAlpha = this.alpha;
        this.drawRawImage();
        this.ctx.globalAlpha = prevAlpha;
    };
    return Fade;
})(Animation);

var FadeIn = (function (_super) {
    __extends(FadeIn, _super);
    function FadeIn(pic, animInfo, canvas, finishedCb) {
        _super.call(this, AnimationType.ENTRANCE, pic, animInfo, canvas, finishedCb);
    }
    FadeIn.title = "fade_in";
    return FadeIn;
})(Fade);
AnimationManager.RegisterAnimation(AnimationType.ENTRANCE, FadeIn);

var FadeOut = (function (_super) {
    __extends(FadeOut, _super);
    function FadeOut(pic, animInfo, canvas, finishedCb) {
        _super.call(this, AnimationType.EXIT, pic, animInfo, canvas, finishedCb);

        // Swap to fade out.
        this.startAlpha = 1;
        this.alphaDelta = -this.alphaDelta;
        this.alpha = this.startAlpha;
    }
    FadeOut.title = "fade_out";
    return FadeOut;
})(Fade);
AnimationManager.RegisterAnimation(AnimationType.EXIT, FadeOut);

var Nop = (function (_super) {
    __extends(Nop, _super);
    function Nop(pic, animInfo, canvas, finishedCb) {
        standardize(animInfo, { duration: 2000 });
        _super.call(this, AnimationType.EMPHASIS, pic, canvas, finishedCb, animInfo.options['duration'], animInfo.options['duration']);
    }
    Nop.prototype.animationStep = function () {
    };

    Nop.prototype.draw = function () {
        this.drawRawImage();
    };
    Nop.title = "nop";
    return Nop;
})(Animation);
AnimationManager.RegisterAnimation(AnimationType.EMPHASIS, Nop);

var Blinds = (function (_super) {
    __extends(Blinds, _super);
    function Blinds(pic, animInfo, canvas, finishedCb) {
        standardize(animInfo, {
            numBlinds: 6,
            duration: 2000
        });
        _super.call(this, AnimationType.ENTRANCE, pic, canvas, finishedCb, animInfo.options['duration']);
        this.blindSize = 0;
        this.numBlinds = animInfo.options['numBlinds'];

        // Calculate blind size and rate of advancement.
        this.maxBlindSize = pic.height / this.numBlinds;
        this.blindDelta = this.maxBlindSize / (this.duration / this.interval);
    }
    Blinds.prototype.reset = function () {
        _super.prototype.reset.call(this);
        this.blindSize = 0;
    };

    Blinds.prototype.animationStep = function () {
        this.blindSize += this.blindDelta;
    };

    Blinds.prototype.draw = function () {
        for (var i = 0; i < this.numBlinds; i++) {
            // Get rectangle for this blind.
            var start_y = this.maxBlindSize * i;
            this.ctx.drawImage(this.pic, 0, start_y, this.pic.width, this.blindSize, 0, start_y, this.pic.width, this.blindSize);
        }
    };
    Blinds.title = "blinds";
    return Blinds;
})(Animation);
AnimationManager.RegisterAnimation(AnimationType.ENTRANCE, Blinds);

/**
* Responsible for handling animation transitions within a slide, and for
* deciding when to advance to the next slide or go back to the previous slide.
*/
var Slide = (function () {
    function Slide(pic, canvas, entranceInfo, emphasisInfo, exitInfo, prevSlide, nextSlide) {
        this.pic = pic;
        this.canvas = canvas;
        // Which type of animation are we currently playing?
        this.currentType = AnimationType.ENTRANCE;
        this.state = AnimationState.PAUSED;
        var _this = this;
        this.entrance = Animation.Create(AnimationType.ENTRANCE, this.pic, entranceInfo, this.canvas, function () {
            _this.switchState(AnimationType.EMPHASIS);
        });
        this.emphasis = Animation.Create(AnimationType.EMPHASIS, this.pic, emphasisInfo, this.canvas, function () {
            _this.switchState(AnimationType.EXIT);
        });
        this.exit = Animation.Create(AnimationType.EXIT, this.pic, exitInfo, this.canvas, function () {
            nextSlide(AnimationType.ENTRANCE);
        });
        this.prevSlide = this.wrapTransition(prevSlide);
        this.nextSlide = this.wrapTransition(nextSlide);
    }
    Slide.prototype.wrapTransition = function (fcn) {
        var _this = this;
        return function (type) {
            // INVARIANT: When not playing, we are at the same state.
            _this.reset();
            fcn(type);
        };
    };

    Slide.prototype.currentAnim = function () {
        switch (this.currentType) {
            case AnimationType.ENTRANCE:
                return this.entrance;
            case AnimationType.EMPHASIS:
                return this.emphasis;
            case AnimationType.EXIT:
                return this.exit;
        }
    };

    /**
    * Switches state to the current animation and animation state.
    * Handles the most important invariants that ensure that animations properly
    * transition from one another.
    */
    Slide.prototype.switchState = function (type, state) {
        if (typeof state === "undefined") { state = this.state; }
        if (type === this.currentType) {
            if (state === this.state) {
                // NOP: Same state.
                return;
            } else {
                this.state = state;

                if (this.state === AnimationState.PAUSED) {
                    return this.currentAnim().pause();
                } else {
                    // Resume
                    return this.currentAnim().play();
                }
            }
        } else {
            // Animation transition!
            this.currentAnim().pause();
            this.currentType = type;
            this.state = state;
            this.currentAnim().skipToStart();
            if (this.state === AnimationState.PLAYING) {
                this.currentAnim().play();
            }
        }
    };

    /**
    * Resets all state built up in this class and the animation classes. Called
    * whenever slideshow control moves to another slide.
    */
    Slide.prototype.reset = function () {
        this.entrance.reset();
        this.emphasis.reset();
        this.exit.reset();
        this.currentType = AnimationType.ENTRANCE;
        this.state = AnimationState.PAUSED;
    };

    /**
    * The slideshow can be in one of the following states when this button is
    * hit:
    * - Playing (or paused during) a fade-in animation.
    *   ACTION: Skip to emphasis animation.
    * - Playing (or paused during) an emphasis animation.
    *   ACTION: Skip to *next picture's* emphasis animation.
    * - Playing (or paused during) a exit animation.
    *   ACTION: Skip to *next picture's* entrance animation.
    */
    Slide.prototype.next = function () {
        switch (this.currentType) {
            case AnimationType.ENTRANCE:
                return this.switchState(AnimationType.EMPHASIS);
            case AnimationType.EMPHASIS:
                return this.nextSlide(AnimationType.EMPHASIS);
            case AnimationType.EXIT:
                return this.nextSlide(AnimationType.ENTRANCE);
        }
    };

    /**
    * The slideshow can be in one of the following states when this button is
    * hit:
    * - Playing (or paused during) a fade-in animation.
    *   ACTION: Skip to *previous picture's* emphasis animation.
    * - Playing (or paused during) an emphasis animation.
    *   ACTION: Skip to *previous picture's* entrance animation.
    * - Playing (or paused during) a fade-out animation.
    *   ACTION: Skip to emphasis animation.
    */
    Slide.prototype.prev = function () {
        switch (this.currentType) {
            case AnimationType.ENTRANCE:
                return this.prevSlide(AnimationType.EMPHASIS);
            case AnimationType.EMPHASIS:
                return this.prevSlide(AnimationType.ENTRANCE);
            case AnimationType.EXIT:
                return this.switchState(AnimationType.EMPHASIS);
        }
    };

    Slide.prototype.pauseToggle = function () {
        this.switchState(this.currentType, this.state === AnimationState.PLAYING ? AnimationState.PAUSED : AnimationState.PLAYING);
    };
    return Slide;
})();

var Slideshow = (function () {
    function Slideshow(canvas, slideInfo, readyCb) {
        this.canvas = canvas;
        this.slides = [];
        this.current = 0;
        this.state = AnimationState.PAUSED;
        var images = [];
        var _this = this;
        var nextSlide = function (type) {
            _this.nextSlide(type);
        };
        var prevSlide = function (type) {
            _this.prevSlide(type);
        };
        var numImages = slideInfo.length;

        // Triggered each time an image downloads.
        var picsReady = function () {
            numImages--;
            if (numImages === 0) {
                for (var i = 0; i < slideInfo.length; i++) {
                    var info = slideInfo[i];
                    _this.insertDefaults(info);
                    _this.slides.push(new Slide(images[i], canvas, info.entrance, info.emphasis, info.exit, prevSlide, nextSlide));
                }
                readyCb();
            }
        };

        for (var i = 0; i < slideInfo.length; i++) {
            var img = new Image();
            images[i] = img;
            img.onload = picsReady;
            img.onerror = picsReady;
            img.src = slideInfo[i].url;
        }
    }
    Slideshow.prototype.insertDefaults = function (info) {
        if (!info.hasOwnProperty('entrance')) {
            info.entrance = {
                type: 'fade_in'
            };
        }
        if (!info.hasOwnProperty('emphasis')) {
            info.emphasis = {
                type: 'nop'
            };
        }
        if (!info.hasOwnProperty('exit')) {
            info.exit = {
                type: 'fade_out'
            };
        }
    };

    Slideshow.prototype.nextSlide = function (type) {
        this.current = (this.current + 1) % this.slides.length;
        this.slides[this.current].switchState(type, this.state);
    };

    Slideshow.prototype.prevSlide = function (type) {
        this.current--;
        if (this.current < 0) {
            this.current = this.slides.length - 1;
        }
        this.slides[this.current].switchState(type, this.state);
    };

    /**
    * Hooked up to user-facing controls.
    */
    Slideshow.prototype.nextControl = function () {
        this.slides[this.current].next();
    };

    /**
    * Pauses/resumes animation.
    */
    Slideshow.prototype.pauseToggle = function () {
        if (this.state === AnimationState.PAUSED) {
            this.state = AnimationState.PLAYING;
        } else {
            this.state = AnimationState.PAUSED;
        }
        this.slides[this.current].pauseToggle();
    };

    Slideshow.prototype.prevControl = function () {
        this.slides[this.current].prev();
    };
    return Slideshow;
})();
