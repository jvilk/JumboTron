class Point {
  constructor(public x:number = 0, public y:number = 0) {}
}

class Rectangle {
  constructor(public start: Point, public end: Point){}

  public intersects(rect: Rectangle): boolean {
    // http://stackoverflow.com/a/306332
    return this.start.x <= rect.end.x && this.end.x >= rect.start.x &&
           this.start.y <= rect.end.y && this.end.y >= rect.start.y;
  }

  // A stupid O(n) algorithm for finding intersecting rectangles.
  // NOTE: If this is too slow, switch to a KD-Tree.
  public static GetIntersectingRects(sourceRect:Rectangle, rects:Rectangle[]): Rectangle[] {
    var rv:Rectangle[] = [];
    for (var i = 0; i < rects.length; i++) {
      var rect = rects[i];
      if (sourceRect.intersects(rect)) {
        rv.push(rect);
      }
    }
    return rv;
  }
}

var buckets: {[prop: string]: number} = {};

// Wraps a HTMLCanvasElement for the SuperCanvas.
class CanvasWrap extends Rectangle {
  public canvas: HTMLCanvasElement;
  constructor(canvas: HTMLCanvasElement) {
    // ASSUMPTION: All canvases are children of <body>, and thus offsetLeft/
    // offsetTop represents its offset relative to the page.
    //var start = new Point(canvas.offsetLeft, canvas.offsetTop);
    //var end = new Point(canvas.offsetLeft + canvas.width, canvas.offsetTop + canvas.height);
    var rect = canvas.getBoundingClientRect();
    var start = new Point(rect.left, rect.top);
    var end = new Point(rect.right, rect.bottom);
    super(start, end);
    this.canvas = canvas;
  }
}

// Wraps one canvas's context, and proxies updates to all other specified
// contexts.
class Wrap2DContext {
  private updateScheduled: boolean = false;

  constructor(public ctx: CanvasRenderingContext2D, public canvas: SuperCanvas) {
    var that = this;
    for (var prop in ctx) {
      if (typeof this[prop] !== 'undefined') {
        continue;
      }

      buckets[prop] = 0;
      if (typeof ctx[prop] === 'function') {
        // Need to create a closure to capture the value of 'prop'.
        this[prop] = (function(prop) {
          return function() {
            buckets[prop]++;
            // Proxy the function call.
            var rv = that.ctx[prop].apply(that.ctx, arguments);
            // Update the super canvas.
            that.scheduleUpdate();
            return rv;
          }
        })(prop);
      } else {
        // Create a closure to capture 'prop'.
        (function(prop) {
		  Object.defineProperty(that, prop, {
		    set: function (val) {
				buckets[prop]++;
				// Proxy the property update.
				that.ctx[prop] = val;
				// Update the super canvas.
				that.scheduleUpdate();
			  },
            get: function() {
              // No need to wrap.
              return that.ctx[prop];
            }});
        })(prop);
      }
    }
  }

  public scheduleUpdate() {
    if (this.updateScheduled) {
      return;
    }
    this.updateScheduled = true;
    var that = this;
    setTimeout(function() {
      that.canvas.update();
      that.updateScheduled = false;
    }, 0);
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
    // Wrap all of the buffer's functions so it can be used in JavaScript as
    // a canvas.
    for (var prop in this.buffer) {
      // Avoid wrapping Object proto BS or things I manually override in
      // SuperCanvas.
      if (typeof this[prop] !== 'undefined') {
        continue;
      }
      if (typeof this.buffer[prop] === 'function') {
        this[prop] = function() {
          return that.buffer[prop].apply(that.buffer, arguments);
        };
      } else {
	    Object.defineProperty(this, prop, {
		  get: function() {
            return that.buffer[prop];
          },
          set: function(val) {
            that.buffer[prop] = val;
          }
		});
      }
    }
  }

  public toDataURL(type?: string, ...args: any[]): string {
    return this.buffer.toDataURL(type, args);
  }

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
    // XXX: Might have to yield to the browser here.
    for (var i = 0; i < this.canvases.length; i++) {
      var wc = this.canvases[i];
      var ctx = wc.canvas.getContext('2d');
      var offsetX = wc.start.x - this.start.x;
      var offsetY = wc.start.y - this.start.y;
      // Translate the coordinates to ones local to this particular canvas.
      ctx.clearRect(0, 0, wc.canvas.width, wc.canvas.height);
      ctx.drawImage(this.buffer, offsetX, offsetY, wc.canvas.width, wc.canvas.height, 0, 0, wc.canvas.width, wc.canvas.height);
    }
  }

  public msToBlob(): Blob {
    return this.buffer.msToBlob();
  }
}