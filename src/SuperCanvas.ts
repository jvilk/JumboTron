// Convenience classes.
class Point {
  constructor(public x:number = 0, public y:number = 0) {}
}
class Rectangle {
  constructor(public start: Point, public end: Point){}
}

// Wraps a HTMLCanvasElement for the SuperCanvas.
class CanvasWrap extends Rectangle {
  public canvas: HTMLCanvasElement;
  constructor(canvas: HTMLCanvasElement) {
    var rect = canvas.getBoundingClientRect();
    var start = new Point(rect.left, rect.top);
    var end = new Point(rect.right, rect.bottom);
    super(start, end);
    this.canvas = canvas;
  }
}

// Wraps the buffer canvas's context. Schedules SuperCanvas updates when it is
// modified.
class Wrap2DContext {
  private updateScheduled: boolean = false;

  constructor(public ctx: CanvasRenderingContext2D, public canvas: SuperCanvas) {
    var that = this;
    // Create a proxy stub for every property on the buffer canvas's context.
    for (var prop in ctx) {
      if (typeof this[prop] !== 'undefined') {
        continue;
      }

      // Create a closure to capture 'prop'.
      (function(prop) {
        if (typeof ctx[prop] === 'function') {
          that[prop] = function() {
            // Proxy the function call.
            var rv = that.ctx[prop].apply(that.ctx, arguments);
            // Update the super canvas.
            that.scheduleUpdate();
            return rv;
          };
        } else {
          Object.defineProperty(that, prop, {
            set: function (val) {
              // Proxy the property update.
              that.ctx[prop] = val;
              // Update the super canvas.
              that.scheduleUpdate();
            },
            get: function() {
              // No need to wrap.
              return that.ctx[prop];
            }
          });
        }
      })(prop);
    }
  }

  // Schedules an update to the SuperCanvas. Ensures that we don't update more
  // often than necessary.
  public scheduleUpdate() {
    if (this.updateScheduled) {
      return;
    }
    this.updateScheduled = true;
    var that = this;
    requestAnimationFrame(function() {
      that.canvas.update();
      that.updateScheduled = false;
    });
  }
}

class SuperCanvas extends Rectangle {
  private canvases:CanvasWrap[] = [];
  private buffer:HTMLCanvasElement;
  private ctx:Wrap2DContext;
  public width: number;
  public height: number;

  constructor(canvases:HTMLCanvasElement[]) {
    super(new Point(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY), new Point(0, 0));

    // Figure out the size of the canvas in pixels.
    for (var i = 0; i < canvases.length; i++) {
      this.canvases.push(new CanvasWrap(canvases[i]));
      var canvas = this.canvases[i];
      if (canvas.start.x < this.start.x) {
        this.start.x = canvas.start.x;
      }
      if (canvas.end.x > this.end.x) {
        this.end.x = canvas.end.x;
      }
      if (canvas.start.y < this.start.y) {
        this.start.y = canvas.start.y;
      }
      if (canvas.end.y > this.end.y) {
        this.end.y = canvas.end.y;
      }
    }
    this.width = this.end.x - this.start.x;
    this.height = this.end.y - this.start.y;

    // Create a backing canvas that will receive all drawing commands.
    this.buffer = document.createElement('canvas');
    this.buffer.width = this.width;
    this.buffer.height = this.height;
    this.ctx = new Wrap2DContext(this.buffer.getContext('2d'), this);

    var that = this;
    // Wrap all of the buffer's functions so the SuperCanvas can be used as a
    // canvas.
    for (var prop in this.buffer) {
      // Avoid wrapping Object proto stuff or things I manually override in
      // SuperCanvas.
      if (typeof this[prop] !== 'undefined') {
        continue;
      }

      // Create a closure to capture prop.
      (function(prop) {
        if (typeof that.buffer[prop] === 'function') {
          that[prop] = function() {
            return that.buffer[prop].apply(that.buffer, arguments);
          };
        } else {
          Object.defineProperty(that, prop, {
            get: function() {
              return that.buffer[prop];
            },
            set: function(val) {
              that.buffer[prop] = val;
            }
          });
        }
      })(prop);
    }
  }

  // Returns the SuperCanvas context -- which is a wrapped version of the
  // buffer's context.
  public getContext(contextId: "2d"): CanvasRenderingContext2D;
  public getContext(contextId: string, ...args: any[]): any;
  public getContext(contextId: any, ...args: any[]) {
    if (contextId !== "2d") {
      throw new Error("Invalid context specified.");
    }
    // ctx upholds the CanvasRenderingContext2D type.
    return this.ctx;
  }

  // Updates all of the individual canvases that comprise the SuperCanvas.
  // Should only be called by Wrap2DContext.
  public update() {
    for (var i = 0; i < this.canvases.length; i++) {
      var wc = this.canvases[i];
      var ctx = wc.canvas.getContext('2d');
      // Determine the X and Y coordinate of the image data in the buffer canvas
      // that we need to copy into this particular canvas.
      var offsetX = wc.start.x - this.start.x;
      var offsetY = wc.start.y - this.start.y;
      // Unfortunately, any time the buffer is cleared, it merely introduces
      // transparent pixels which, when applied to this canvas, do not remove
      // anything that's already on it. So we must explicitly clear the canvas
      // for every update.
      ctx.clearRect(0, 0, wc.canvas.width, wc.canvas.height);
      ctx.drawImage(this.buffer, offsetX, offsetY, wc.canvas.width, wc.canvas.height, 0, 0, wc.canvas.width, wc.canvas.height);
    }
  }
}