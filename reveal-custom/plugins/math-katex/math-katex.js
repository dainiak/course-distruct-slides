const RevealKatex = {
	id: 'math',
	init: (reveal) => {
		let options = reveal.getConfig().math || {};
		options = {
			katexUrl: options.katexUrl || 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.13.18/katex.min.js',
			autorenderUrl: options.autorenderUrl || 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.13.18/contrib/auto-render.min.js',
			katexCssUrl: options.katexCssUrl || 'https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.13.18/katex.min.css',
			resetFragmentIndicesAfterTypeset: options.resetFragmentIndicesAfterTypeset !== false,
			fragmentIndexCSS: options.fragmentIndexCSS !== false,
			macros: options.macros || {}
		};

		let macros = {
			"\\bbA": "{\\mathbb{A}}",
			"\\bbB": "{\\mathbb{B}}",
			"\\bbF": "{\\mathbb{F}}",
			"\\bbN": "{\\mathbb{N}}",
			"\\bbP": "{\\mathbb{P}}",
			"\\bbQ": "{\\mathbb{Q}}",
			"\\bbR": "{\\mathbb{R}}",
			"\\bbZ": "{\\mathbb{Z}}",
			"\\calA": "{\\mathcal{A}}",
			"\\calB": "{\\mathcal{B}}",
			"\\calC": "{\\mathcal{C}}",
			"\\calD": "{\\mathcal{D}}",
			"\\calF": "{\\mathcal{F}}",
			"\\calG": "{\\mathcal{G}}",
			"\\calI": "{\\mathcal{I}}",
			"\\calM": "{\\mathcal{M}}",
			"\\calN": "{\\mathcal{N}}",
			"\\calO": "{\\mathcal{O}}",
			"\\calR": "{\\mathcal{R}}",
			"\\calS": "{\\mathcal{S}}",
			"\\bfA": "{\\mathbf{A}}",
			"\\bfa": "{\\mathbf{a}}",
			"\\bfb": "{\\mathbf{b}}",
			"\\bfc": "{\\mathbf{c}}",
			"\\bfe": "{\\mathbf{e}}",
			"\\bfw": "{\\mathbf{w}}",
			"\\bfx": "{\\mathbf{x}}",
			"\\bfy": "{\\mathbf{y}}",
			"\\bfz": "{\\mathbf{z}}",
			"\\floor": "{\\left\\lfloor #1 \\right\\rfloor}",
			"\\ceil": "{\\left\\lceil #1 \\right\\rceil}",
			"\\le": "\\leqslant",
			"\\ge": "\\geqslant",
			"\\hat": "\\widehat",
			"\\emptyset": "\\varnothing",
			"\\epsilon": "\\varepsilon",
			"\\fragidx": "\\htmlClass{fragment fragidx-#1}{#2}",
			"\\sfragidx": "\\htmlClass{fragment fade-in-then-semi-out fragidx-#1}{#2}",
			"\\vfragidx": "\\rlap{\\class{fragment fade-in-then-out fragidx-#1}{#2}}",
			"\\underbracket": "\\mathop{\\underset{\\mmlToken{mo}{⎵}}{#2}}\\limits_{#1}",
			"\\next": "\\htmlClass{fragment}{#1}",
			"\\step": "\\htmlClass{fragment fade-in-then-semi-out}{#1}",
			"\\vstep": "\\rlap{\\htmlClass{fragment fade-in-then-out}{#1}}",
			"\\zoomable": "\\htmlClass{zoomable}{#1}",
			"\\green": "\\htmlClass{green}{#1}",
			"\\red": "\\htmlClass{red}{#1}"
		};

		for(let macroName in options.macros){
			let macroDefinition = options.macros[macroName]
			if(macroDefinition instanceof Array)
				macroDefinition = macroDefinition[0];
			if(!macroName.startsWith('\\'))
				macroName = '\\' + macroName
			macros[macroName] = macroDefinition;
		}

		let scriptsToLoad = [
			{
				url:
				options.katexCssUrl,
				condition:
					!window.katex
					&& !document.querySelector('script[src="' + options.katexUrl + '"]')
			}, {
				url:
				options.katexUrl,
				condition:
					!window.katex
					&& !document.querySelector('script[src="' + options.katexUrl + '"]')
			},{
				url:
				options.autorenderUrl,
				condition:
					!window.renderMathInElement
					&& !document.querySelector('script[src="' + options.autorenderUrl + '"]')
			}
		];

		function renderMath() {
			window.addEventListener('load', function(){
				window.renderMathInElement(
					reveal.getViewportElement(),
					{
						delimiters: [
							{left: "\\(", right: "\\)", display: false},
							{left: "\\[", right: "\\]", display: true}
						],
						strict: false,
						trust: true,
						macros: macros
					}
				);

				if(options.resetFragmentIndicesAfterTypeset || options.fragmentIndexCSS) {
					for(let slide of reveal.getSlides()){
						for (let fragment of slide.querySelectorAll('.fragment'))
							if (fragment.hasAttribute('data-fragment-index'))
								fragment.removeAttribute('data-fragment-index');

						for(let i = 0; i < 15; ++i) {
							let fragments = slide.querySelectorAll('.fragment.fragidx-' + i.toString());
							for(let fragment of fragments)
								fragment.setAttribute('data-fragment-index', i);
						}
					}
				}
				reveal.layout();
			});
		}


		function loadScript(params, extraCallback) {
			if(params.condition !== undefined
				&& !(params.condition === true || typeof params.condition == 'function' && params.condition.call())) {
				return extraCallback ? extraCallback.call() : false;
			}

			if( params.type === undefined ) {
				params.type = (params.url && params.url.match(/\.css[^.]*$/)) ? 'text/css' : 'text/javascript';
			}

			let script = null;

			if( params.type === 'text/css' ){
				if( params.content ){
					script = document.createElement('style');
					script.textContent = params.content;
				}
				else {
					script = document.createElement('link');
					script.rel = 'stylesheet';
					script.type = 'text/css';
					script.href = params.url;
				}
			}
			else {
				script = document.createElement('script');
				script.type = params.type || 'text/javascript';
				if( params.content ) {
					script.textContent = params.content;
				}
				else {
					script.src = params.url;
				}
			}

			if(params.content){
				document.querySelector('head').appendChild( script );
				if(params.callback) {
					params.callback.call();
				}
				if(extraCallback) {
					extraCallback.call();
				}
			}
			else {
				script.onload = function(){
					if(params.callback) {
						params.callback.call();
					}
					if(extraCallback) {
						extraCallback.call();
					}
				};

				document.querySelector( 'head' ).appendChild( script );
			}
		}

		function loadScripts( scripts, callback ) {
			if(!scripts || scripts.length === 0) {
				if (typeof callback === 'function') {
					if(reveal.isReady()) {
						callback.call();
						callback = null;
					}
					else {
						reveal.addEventListener('ready', function () {
							callback.call();
							callback = null;
						});
					}
				}
				return;
			}

			let script = scripts.splice(0, 1)[0];
			loadScript(script, function () {
				loadScripts(scripts, callback);
			});
		}

		loadScripts(scriptsToLoad, renderMath);

		return true;
	}
};

// export default () => RevealInking;