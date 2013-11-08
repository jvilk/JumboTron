class CanvasBenchmark {
  private ctx: CanvasRenderingContext2D;
  private counter: number = 0;
  private done: boolean = false;
  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d");
    // Render as fast as we can.
    var _this = this;
    var renderCb = function() {
      if (_this.done) {
        return;
      }
      _this.drawTest();
      requestAnimationFrame(renderCb);
    };
    requestAnimationFrame(renderCb);
    var duration = 10;
    setTimeout(function() {
      _this.done = true;
      // Calculate FPS
      var fps = _this.counter / duration;
      console.log(fps);
    }, 10*1000);
  }

  private drawTest() {
    counter++;
  }
}