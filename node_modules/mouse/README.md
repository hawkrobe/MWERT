# Mouse

Mouse providers an interface that represents the mouse itself as an object with state. `window.Mouse` points to the constructor. Only one instance of `Mouse` should exist per `window`. `window.mouse` points to a context's single mouse instance.

# Event Handling

`window.mouse` (just `mouse` from now on) provides existing mouse methods as well as normalizes some and adds new ones.


* __down__: mousedown
* __up__: mouseup
* __move__: mousemove
* __click__: click and contextmenu
* __dblclick__: dbleclick
* __leave__: Uses mouseout but only fires when the mouse leaves the window entirely
* __enter__: Uses mouseover but only fires when the mouse enters the window from outside
* __wheel__: mousewheel and wheel events

# API
The following functions are provided to allow management of listeners. Types is a string of type names separated by spaces for multiple events.

* __mouse.on(types, callback)__: add callback as listener for each type in types
* __mouse.off(types, callback)__: remove callback from listeners for each type in types
* __mouse.once(types, callback)__: add callback as listener for the first time each type in types fires, then removes it
* __mouse.emit(evt)__: takes MouseEvent object and runs the event through the callbacks the same as when a native event is received. Type is determined from the event object
* __new Mouse(view)__: initializes mouse instance for given view. This is done automatically for main window, but this could be run on, for example, an iframe's window to provide a mouse object scope to the iframe.

# Button handling

Mouse button state is tracked and `MouseEvent.prototype` is augmented in two ways:

* __buttons__: a getter that returns the buttons as per the W3C spec (only first 3 buttons currently). That is logical combination of the button states. left is 1, middle is 2, right is 4. All through would be 7, etc.
* __states__: function that interprets the number from buttons into an object like `{ left: true/false, middle: true/false, right: true/false }`