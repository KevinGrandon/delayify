(function() {

	if( !(document.getElementsByClassName instanceof Function) ) {
		document.getElementsByClassName = function(searchClass,node,tag) {
		  var classElements = [];
		  if ( node == null )
			node = document;
		  if ( tag == null )
			tag = '*';
		  var els = node.getElementsByTagName(tag),
		  	elsLen = els.length,
		  	pattern = new RegExp("(^|\\s)"+searchClass+"(\\s|$)");
		  for (i = 0, j = 0; i < elsLen; i++) {
			if ( pattern.test(els[i].className) ) {
			  classElements[j] = els[i];
			  j++;
			}
		  }
		  return classElements;
		}
	}


	/**
	 * Loads a third party script based on content wrapped inside of textarea
	 * The textarea should have a class of "delayify"
	 * 		e.g.: <textarea class="delayify" style="display:none;">alert('delay me');</textarea>
	 * @param object Textarea node that we are working with
	 * @param function Callback to call after execution is done
	 */
	function delayify(element, callback) {

		if( typeof element === 'undefined' || !element ) {
			return;
		}

		if( typeof callback === 'undefined' || !callback ) {
			callback = false;
		}

		var localStaticContainer = document.createElement('div'),
		textareaParentNode = element.parentNode,

		mythis = this,

		// Stack of raw content
		// Document.write inserts into this
		contentStack = '',

		/**
		 * Process an arbitrary string of HTML and turns it into a stack of actionable items
		 * @param string HTML string of content. May contain <script> tags
		 */
		processRawContent = function(content) {

			contentStack += content;

			// Stack of callbacks to make
			var localStack = [],
		
			/**
			 * Returns a callback to download a script
			 */
			makeScriptCallback = function(src) {
				return {
					type: 'script',
					// For now just return the SRC and let the stack handler deal with it
					callback: function() {
						return src;
					}
				};
			},
		
			/**
			 * Returns a callback to evaluate code
			 */
			makeEvalCallback = function(rawScript) {
				return {
					type: 'eval',
					callback: function() {
						eval(rawScript);
					}
				};
			},
		
			srcPattern = new RegExp('src=(?:(["\'])([\\s\\S]*?)\\1|([^\\s>]+))','i'),
		
			contentStackReplaced = contentStack.replace(/<script(?:[\s\S]*?)>([\S\s]*?)<\/script>/ig, function(all,code) {
				
				var generatedCallback, matches;

				// If there is non whitespace in the code and we can find an SRC, it's a script
				if( ( !/[A-Za-z0-9]/.test(code) || code === '') && srcPattern.test(all) ) {
					matches = all.match(srcPattern);

					// Matches position [2] OR [3] (in really bad cases when there are no quotes) may contain the src
					generatedCallback = makeScriptCallback( matches[2] || matches[3] );
				} else {
					generatedCallback = makeEvalCallback(code);
				}
				localStack.push(generatedCallback);
		
				return "";
			});

			contentStack = contentStackReplaced;
		
			localStaticContainer.innerHTML = contentStack;

			// Append non-script elements
			textareaParentNode.innerHTML = '';

			var childNodes = localStaticContainer.getElementsByTagName('*'),
				childNodeLength = childNodes.length,
				i;
			
			for( i = 0 ; i < childNodeLength ; i++ ) {
				if( localStaticContainer.nodeType != 1 ) { continue; } 
				try {
					textareaParentNode.appendChild(childNodes[i]);
				} catch(e){}
			}

			return localStack;
		};

		var executionStack = processRawContent(element.value);

		if( callback !== false ) {
			executionStack.push({type: 'callback', callback: callback}); // Make our callback last on the stack
		}

		try {
			textareaParentNode.removeChild(element); // Remove the textarea from the dom
		} catch(e) {}

		// Keeps track of the position to insert items into our stack at.
		// Sometimes there are doc.writes() in a row, and we need them to execute in the correct order
		var docWriteIdx = 0;

		// Hijack document write to insert things into our stack
		document.write = document.writeln = function(injectContent) {
			var newStack = processRawContent(injectContent),
				i;

			for( i = 0 ; i < newStack.length ; i++ ) {
				// Insert into the stack at the specified value
				executionStack.splice(docWriteIdx, 0, newStack[i]);
				docWriteIdx++;
			}

			return true;
		};

		var stackProcessing = false,

		/**
		 * Run through the stack in a synchronous way, pausing between each
		 * Remote scripts get downloaded, and we wait to continue until they're done
		 * Eval content get evaluated, etc etc
		 */
		popStack = function() {

			if( executionStack.length === 0 ) {
				// We've processed everything and there was a script last or something
				return true;
			}

			// If we have a docWrite item, change the stack insert position
			if( docWriteIdx > 0 ) {
				docWriteIdx--;
			}

			// We are processing now
			stackProcessing = true;

			var stackObj = executionStack.shift();
			if( stackObj.type === 'script' ) {
				var sUrl = stackObj.callback(),
					scriptFinished = function() {
						stackProcessing = false;
						popStack();
					};
				try {
					var s = document.createElement('script');
					s.type = "text/javascript";
					s.async = true;
					s.src = sUrl;
					s.addEventListener('load', scriptFinished, false);
					var head = document.getElementsByTagName('head')[0];
					head.appendChild(s);

				} catch(e) {
				}
			} else if( stackObj.type === 'eval' || stackObj.type === 'callback' ) {
				try {
					stackObj.callback();
					stackProcessing = false;
				} catch(e) {
				}

				popStack();
			}
		};

		if( executionStack.length > 0 ) {
			popStack();
			return;
		}
	};
	

	var loadAllScripts = function() {
		// Get all of the delayable scripts
		var scriptsToDelayRaw = document.getElementsByClassName('delayify', 'textarea'),
			scriptsToDelay = [];

		// Convert the html collection to an array
		// We could use some fancy array.slice magic, but we want this to work in ie6
		for( var j = 0 ; j < scriptsToDelayRaw.length ; j++ ) {
			scriptsToDelay.push(scriptsToDelayRaw[j]);
		}
	
		// Build a synchronous callback chain
		var chainDelay = function() {
			var currentNode = scriptsToDelay.shift(),
				callback = null,
				delayedAd;
	
			if( scriptsToDelay.length > 0 ) {
				callback = chainDelay();
			}
	
			return function() {
				delayedAd = delayify(currentNode, callback);
			};
		},
	
		initDelayify = chainDelay();
		initDelayify();
	};

	if ( window.attachEvent ) {
	  window.attachEvent('onload', loadAllScripts );
	} else {
		window.addEventListener('load', loadAllScripts, false);
	}

	
}());