SuperCanvas
===========
SuperCanvas takes multiple independent canvases on the same page, and presents
them to your JavaScript program as a single canvas. Consider it a jumbotron for
your webpage.

Usage
-----
```javascript
// Take all of your pages' canvases, and make them into a super canvas.
var canvas = new SuperCanvas(document.getElementsByTagName('canvas'));
// Use 'canvas' like a regular canvas.
// Grab its context, draw stuff, etc.
var ctx = canvas.getContext('2d');
```

Basically, you should be able to drop SuperCanvas into an unmodified
application; just tell the application to use your SuperCanvas as the canvas.

Technical Details
-----------------
SuperCanvas constructs an invisible canvas that is the size of your combined
canvases. It applies all changes to this canvas, and then updates the canvases
on your web page.
