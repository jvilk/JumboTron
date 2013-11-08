interface AnimationInfo {
  type: string;
  options?: {[prop: string]: any};
}

interface SlideInfo {
  url: string;
  entrance?: AnimationInfo;
  emphasis?: AnimationInfo;
  exit?: AnimationInfo;
}

interface SlideTransitionCallback {
  (type: AnimationType): void;
}

interface AnimationConstructor {
  title: string;
  new (pic: HTMLImageElement, animInfo: AnimationInfo, canvas: HTMLCanvasElement,
       finishedCb: () => void): Animation;
}

enum AnimationType {
  ENTRANCE,
  EMPHASIS,
  EXIT
}

enum AnimationState {
  PLAYING,
  PAUSED
}

/**
 * Singleton class. Manages all of the animation types.
 */
class AnimationManager {
  private static EntranceAnimations: {[name: string]: AnimationConstructor} = {};
  private static EmphasisAnimations: {[name: string]: AnimationConstructor} = {};
  private static ExitAnimations: {[name: string]: AnimationConstructor} = {};
  private static GetDB(type: AnimationType): {[name: string]: AnimationConstructor} {
    var db: {[name: string]: AnimationConstructor};
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
  }

  public static RegisterAnimation(type: AnimationType, anim: AnimationConstructor): void {
    var db = AnimationManager.GetDB(type);
    if (db.hasOwnProperty(anim.title)) {
      throw new Error("Animation already defined: " + anim.title);
    }
    db[anim.title] = anim;
  }

  public static GetAnimation(type: AnimationType, name: string): AnimationConstructor {
    var db = AnimationManager.GetDB(type);
    if (!db.hasOwnProperty(name)) {
      throw new Error("Animation not defined: " + name);
    }
    return db[name];
  }
}

class Animation {
  /**
   * Factory methods for creating animations.
   */
  public static Create(type: AnimationType, pic: HTMLImageElement, info: AnimationInfo,
    canvas: HTMLCanvasElement, finishedCb: () => void): Animation {
    var cons = AnimationManager.GetAnimation(type, info.type);
    return new cons(pic, info, canvas, finishedCb);
  }

  private intervalId: number = -1;
  public ctx: CanvasRenderingContext2D;
  public timeElapsed: number;
  private animationStepLambda: () => void;
  constructor(
    public type: AnimationType,
    public pic: HTMLImageElement,
    public canvas: HTMLCanvasElement,
    public finishedCb: () => void,
    public duration: number = 5000,
    public interval: number = 50) {
    this.ctx = this.canvas.getContext("2d");
    this.reset();

    var _this = this;
    this.animationStepLambda = function() {
      _this.timeElapsed += _this.interval;
      _this.animationStep();
      _this.draw();

      if (_this.timeElapsed >= _this.duration) {
        _this.reset();
        _this.finishedCb()
      }
    };
  }

  /**
   * Abstract method: Should be overridden by child classes. Advances the
   * animation by one step, and draws the updated animation to the canvas.
   */
  public animationStep(): void {
    throw new Error("Animation is an abstract class and does not implement animationStep.");
  }

  /**
   * Abstract method.
   * Draws the current frame of the animation.
   * Invariants:
   * - Does not mutate Animation state!
   * - Leave No Trace on the canvas:
   *     Reset any properties set for drawing to their previous state.
   */
  public draw(): void {
    throw new Error("Animation is an abstract class and does not implement draw.");
  }

  private startInterval() {
    this.intervalId = setInterval(this.animationStepLambda, this.interval);
  }

  private stopInterval() {
    if (this.intervalId > -1) {
      clearInterval(this.intervalId);
      this.intervalId = -1;
    }
  }

  /**
   * Resumes playback of the animation from its current state.
   */
  public play() {
    this.startInterval();
  }

  /**
   * Pauses animation playback.
   */
  public pause() {
    this.stopInterval();
  }

  /**
   * Resets all mutable state in the animation to its starting default state.
   * Does not touch the canvas.
   */
  public reset() {
    this.stopInterval();
    this.timeElapsed = 0;
  }

  /**
   * Sets the canvas to be completely transparent.
   */
  public clearCanvas(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draws the unmodified image on the canvas.
   */
  public drawRawImage(): void {
    this.clearCanvas();
    this.ctx.drawImage(this.pic, 0, 0);
  }

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
   * TODO: Allow animations to flow into another; relax this property.
   */
  public skipToStart(): void {
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
  }
}

function standardize(info: AnimationInfo, defaultOptions: {[prop: string]: any}) {
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

class Fade extends Animation {
  public alphaDelta: number;
  public startAlpha: number;
  public alpha: number;
  constructor (type: AnimationType, pic: HTMLImageElement, animInfo: AnimationInfo,
               canvas: HTMLCanvasElement, finishedCb: () => void) {
    standardize(animInfo, { duration: 2000 });
    super(type, pic, canvas, finishedCb, animInfo.options['duration']);
    // Default to fade in.
    this.alphaDelta = 1 / (this.duration / this.interval);
    this.startAlpha = 0;
    this.alpha = 0;
  }

  public reset() {
    super.reset();
    this.alpha = this.startAlpha;
  }

  public animationStep(): void {
    this.alpha += this.alphaDelta;
  }

  public draw(): void {
    var prevAlpha = this.ctx.globalAlpha;
    this.ctx.globalAlpha = this.alpha;
    this.drawRawImage();
    this.ctx.globalAlpha = prevAlpha;
  }
}

class FadeIn extends Fade {
  public static title: string = "fade_in";
  constructor (pic: HTMLImageElement, animInfo: AnimationInfo,
               canvas: HTMLCanvasElement, finishedCb: () => void) {
    super(AnimationType.ENTRANCE, pic, animInfo, canvas, finishedCb);
  }
}
AnimationManager.RegisterAnimation(AnimationType.ENTRANCE, FadeIn);

class FadeOut extends Fade {
  public static title: string = "fade_out";
  constructor (pic: HTMLImageElement, animInfo: AnimationInfo,
               canvas: HTMLCanvasElement, finishedCb: () => void) {
    super(AnimationType.EXIT, pic, animInfo, canvas, finishedCb);
    // Swap to fade out.
    this.startAlpha = 1;
    this.alphaDelta = -this.alphaDelta;
    this.alpha = this.startAlpha;
  }
}
AnimationManager.RegisterAnimation(AnimationType.EXIT, FadeOut);

class Nop extends Animation {
  public static title: string = "nop";
  constructor(pic: HTMLImageElement, animInfo: AnimationInfo,
              canvas: HTMLCanvasElement, finishedCb: () => void) {
    standardize(animInfo, { duration: 2000 });
    super(AnimationType.EMPHASIS, pic, canvas, finishedCb,
      animInfo.options['duration'], animInfo.options['duration']);
  }

  public animationStep(): void {
  }

  public draw(): void {
    this.drawRawImage();
  }
}
AnimationManager.RegisterAnimation(AnimationType.EMPHASIS, Nop);

class Blinds extends Animation {
  public static title: string = "blinds";
  private numBlinds: number;
  private blindSize: number;
  private maxBlindSize: number;
  private blindDelta: number;
  constructor(pic: HTMLImageElement, animInfo: AnimationInfo,
              canvas: HTMLCanvasElement, finishedCb: () => void) {
    standardize(animInfo, {
      numBlinds: 6,
      duration: 2000
    });
    super(AnimationType.ENTRANCE, pic, canvas, finishedCb, animInfo.options['duration']);
    this.blindSize = 0;
    this.numBlinds = animInfo.options['numBlinds'];
    // Calculate blind size and rate of advancement.
    this.maxBlindSize = pic.height / this.numBlinds;
    this.blindDelta = this.maxBlindSize / (this.duration / this.interval);
  }

  public reset() {
    super.reset();
    this.blindSize = 0;
  }

  public animationStep() {
    this.blindSize += this.blindDelta;
  }

  public draw() {
    for (var i = 0; i < this.numBlinds; i++) {
      // Get rectangle for this blind.
      var start_y = this.maxBlindSize * i;
      this.ctx.drawImage(this.pic, 0, start_y, this.pic.width, this.blindSize,
        0, start_y, this.pic.width, this.blindSize);
    }
  }
}
AnimationManager.RegisterAnimation(AnimationType.ENTRANCE, Blinds);

/**
 * Responsible for handling animation transitions within a slide, and for
 * deciding when to advance to the next slide or go back to the previous slide.
 */
class Slide {
  // Which type of animation are we currently playing?
  private currentType: AnimationType = AnimationType.ENTRANCE;
  private state: AnimationState = AnimationState.PAUSED;
  private prevSlide: SlideTransitionCallback;
  private nextSlide: SlideTransitionCallback;
  private entrance: Animation;
  private emphasis: Animation;
  private exit: Animation;
  constructor(
    private pic: HTMLImageElement,
    public canvas: HTMLCanvasElement,
    entranceInfo: AnimationInfo,
    emphasisInfo: AnimationInfo,
    exitInfo: AnimationInfo,
    prevSlide: SlideTransitionCallback,
    nextSlide: SlideTransitionCallback) {
    var _this = this;
    this.entrance = Animation.Create(AnimationType.ENTRANCE, this.pic, entranceInfo, this.canvas, function() {
      _this.switchState(AnimationType.EMPHASIS);
    });
    this.emphasis = Animation.Create(AnimationType.EMPHASIS, this.pic, emphasisInfo, this.canvas, function() {
      _this.switchState(AnimationType.EXIT);
    });
    this.exit = Animation.Create(AnimationType.EXIT, this.pic, exitInfo, this.canvas, function() {
      nextSlide(AnimationType.ENTRANCE);
    });
    this.prevSlide = this.wrapTransition(prevSlide);
    this.nextSlide = this.wrapTransition(nextSlide);
  }

  private wrapTransition(fcn: SlideTransitionCallback): SlideTransitionCallback {
    var _this = this;
    return function(type: AnimationType): void {
      // INVARIANT: When not playing, we are at the same state.
      _this.reset();
      fcn(type);
    };
  }

  private currentAnim(): Animation {
    switch (this.currentType) {
      case AnimationType.ENTRANCE:
        return this.entrance;
      case AnimationType.EMPHASIS:
        return this.emphasis;
      case AnimationType.EXIT:
        return this.exit;
    }
  }

  /**
   * Switches state to the current animation and animation state.
   * Handles the most important invariants that ensure that animations properly
   * transition from one another.
   */
  public switchState(type: AnimationType, state: AnimationState = this.state): void {
    if (type === this.currentType) {
      if (state === this.state) {
        // NOP: Same state.
        return;
      } else {
        this.state = state;
        // Same animation, different state: Pause/resume.
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
  }

  /**
   * Resets all state built up in this class and the animation classes. Called
   * whenever slideshow control moves to another slide.
   */
  private reset(): void {
    this.entrance.reset();
    this.emphasis.reset();
    this.exit.reset();
    this.currentType = AnimationType.ENTRANCE;
    this.state = AnimationState.PAUSED;
  }

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
  public next(): void {
    switch(this.currentType) {
      case AnimationType.ENTRANCE:
        return this.switchState(AnimationType.EMPHASIS);
      case AnimationType.EMPHASIS:
        return this.nextSlide(AnimationType.EMPHASIS);
      case AnimationType.EXIT:
        return this.nextSlide(AnimationType.ENTRANCE);
    }
  }

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
  public prev() {
    switch(this.currentType) {
      case AnimationType.ENTRANCE:
        return this.prevSlide(AnimationType.EMPHASIS);
      case AnimationType.EMPHASIS:
        return this.prevSlide(AnimationType.ENTRANCE);
      case AnimationType.EXIT:
        return this.switchState(AnimationType.EMPHASIS);
    }
  }

  public pauseToggle(): void {
    this.switchState(this.currentType, this.state === AnimationState.PLAYING ? AnimationState.PAUSED : AnimationState.PLAYING);
  }
}

class Slideshow {
  private slides: Slide[] = [];
  private current: number = 0;
  private state: AnimationState = AnimationState.PAUSED;
  constructor(private canvas: HTMLCanvasElement, slideInfo: SlideInfo[],
              readyCb: () => void) {
    var images: HTMLImageElement[] = [];
    var _this = this;
    var nextSlide = function(type: AnimationType) {
      _this.nextSlide(type);
    };
    var prevSlide = function(type: AnimationType) {
      _this.prevSlide(type);
    };
    var numImages = slideInfo.length;

    // Triggered each time an image downloads.
    var picsReady = function() {
      numImages--;
      if (numImages === 0) {
        for (var i = 0; i < slideInfo.length; i++) {
          var info = slideInfo[i]
          _this.insertDefaults(info);
          _this.slides.push(new Slide(images[i], canvas, info.entrance,
            info.emphasis, info.exit, prevSlide, nextSlide));
        }
        readyCb();
      }
    };

    // Download all of the images.
    for (var i = 0; i < slideInfo.length; i++) {
      var img = new Image();
      images[i] = img;
      img.onload = picsReady;
      img.onerror = picsReady;
      img.src = slideInfo[i].url;
    }
  }

  private insertDefaults(info: SlideInfo) {
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
  }

  private nextSlide(type: AnimationType) {
    this.current = (this.current + 1) % this.slides.length;
    this.slides[this.current].switchState(type, this.state);
  }

  private prevSlide(type: AnimationType) {
    this.current--;
    if (this.current < 0) {
      this.current = this.slides.length - 1;
    }
    this.slides[this.current].switchState(type, this.state);
  }

  /**
   * Hooked up to user-facing controls.
   */
  public nextControl() {
    this.slides[this.current].next();
  }

  /**
   * Pauses/resumes animation.
   */
  public pauseToggle() {
    if (this.state === AnimationState.PAUSED) {
      this.state = AnimationState.PLAYING;
    } else {
      this.state = AnimationState.PAUSED;
    }
    this.slides[this.current].pauseToggle();
  }

  public prevControl() {
    this.slides[this.current].prev();
  }
}