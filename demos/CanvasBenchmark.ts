/**
 * Wraps a canvas, and exposes helper methods for updating its contents.
 */
class TestCanvas {
  private ctx: CanvasRenderingContext2D;
  private parent: any;
  private oddFrame: boolean = false;
  private width: number;
  private height: number;
  constructor(private canvas: HTMLCanvasElement,
    private pattern1: HTMLCanvasElement, private pattern2: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d");
    this.parent = this.canvas.parentNode;
    // Cache size information.
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    // Initialize contents of canvas.
    this.draw();
  }

  /**
   * Updates the canvas to the next frame.
   */
  public draw(): void {
    // Flip to the next frame.
    this.oddFrame = !this.oddFrame;
    this.parent.style.opacity = this.oddFrame ? 0.99 : 1;
    var pattern: HTMLCanvasElement = this.oddFrame ? this.pattern1 : this.pattern2;
    this.ctx.drawImage(pattern, 0, 0, this.width, this.height, 0, 0, this.width, this.height);
  }
}

/**
 * Runs a benchmark test on a given set of canvases.
 */
class CanvasBenchmark {
  private canvases: TestCanvas[] = [];
  private count: number = 0;
  private lastTime: number;
  private fpsHistory: number[] = [];
  constructor(private name: string, canvases: HTMLCanvasElement[]) {
    var i, maxHeight = 0, maxWidth = 0;
    // Determine maximum height/width;
    for (i = 0; i < canvases.length; i++) {
      if (canvases[i].height > maxHeight) maxHeight = canvases[i].height;
      if (canvases[i].width > maxWidth) maxWidth = canvases[i].width;
    }
    var patterns = this.all_pixel_test_pattern(maxWidth, maxHeight);

    // Wrap all of the canvases.
    for (i = 0; i < canvases.length; i++) {
      this.canvases.push(new TestCanvas(canvases[i], patterns[0], patterns[1]));
    }
  }

  /**
   * Calculates and reports benchmark results to the user.
   */
  private reportResults(): void {
    if (this.fpsHistory.length < 4) {
      console.error("ERROR: Benchmark ended prematurely.");
      return;
    }
    // We discard the first three data points.
    var results = this.average(this.fpsHistory.slice(3));
    var resultsString = "Benchmark " + this.name + " FPS Stats: Mean - " + results.mean + " Variance - " + results.variance + " Std. Dev - " + results.deviation;
    window.alert(resultsString);
  }

  /**
   * Constructs the two patterns to use for the all_pixel_test.
   * These patterns contain alternating black/white lines.
   */
  private all_pixel_test_pattern(width: number, height: number): HTMLCanvasElement[] {
    var pattern1 = document.createElement('canvas'),
        pattern2 = document.createElement('canvas');
    pattern1.width = pattern2.width = width;
    pattern1.height = pattern2.height = height;
    var pctx1 = pattern1.getContext('2d'),
        pctx2 = pattern2.getContext('2d');
    // Alternating black/white lines.
    var barHeight = Math.ceil(height/10);
    for (var i = 0; i < height; i++) {
      if (Math.floor(i/barHeight)%2 === 0) {
        // Odd
        pctx1.strokeStyle = '#FFFFFF';
        pctx2.strokeStyle = '#000000';
      } else {
        // Even
        pctx2.strokeStyle = '#FFFFFF';
        pctx1.strokeStyle = '#000000';
      }

      pctx1.beginPath();
      pctx2.beginPath();
      pctx1.moveTo(0, i);
      pctx2.moveTo(0, i);
      pctx1.lineTo(width, i);
      pctx2.lineTo(width, i);
      pctx1.stroke();
      pctx2.stroke();
    }
    return [pattern1, pattern2];
  }

  /**
   * Calculates the mean / variance / std. deviation of an array of numbers.
   * From http://jsfiddle.net/hiddenloop/TPeJt/
   */
  private average(a: number[]): {mean: number; variance: number; deviation: number} {
    var r = {mean: 0, variance: 0, deviation: 0}, t = a.length;
    for(var m, s = 0, l = t; l--; s += a[l]);
    for(m = r.mean = s / t, l = t, s = 0; l--; s += Math.pow(a[l] - m, 2));
    return r.deviation = Math.sqrt(r.variance = s / t), r;
  }

  /**
   * Kicks off the benchmark.
   */
  public start(cb: ()=>void): void {
    // Record the current time.
    this.lastTime = Date.now();
    var _this = this;
    var testFrame = function() {
      var timeElapsed: number, timeNow: number;
      // Update canvases.
      for (var i = 0; i < _this.canvases.length; i++) {
        _this.canvases[i].draw();
      }

      if (++_this.count >= 60) {
        // Check FPS.
        timeNow = Date.now();
        timeElapsed = timeNow - _this.lastTime;
        if (_this.fpsHistory.push(_this.count / (timeElapsed/1000)) >= 13) {
          // End the test!
          _this.reportResults();
          return cb();
        }

        _this.lastTime = timeNow;
        _this.count = 0;
      }
      setTimeout(testFrame, 0);
    };
    setTimeout(testFrame, 0);
  }

  /**
   * Automatically constructs and executes a test.
   */
  public static AutoTest(name: string = '[auto]', cb: ()=>void = function(){}): void {
    if (document.readyState === "complete") {
      (new CanvasBenchmark(name, <HTMLCanvasElement[]><any> document.getElementsByTagName('canvas'))).start(cb);
    } else {
      window.addEventListener('load', function() {
        (new CanvasBenchmark(name, <HTMLCanvasElement[]><any> document.getElementsByTagName('canvas'))).start(cb);
      });
    }
  }
}
