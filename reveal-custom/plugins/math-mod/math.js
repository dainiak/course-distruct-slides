const RevealMath = {
    id: 'math',
    init: (reveal) => {
        let options = reveal.getConfig().math || {};
        options = {
            svg: {
                enabled: (options.svg !== false) && (options.svg && options.svg.enabled !== false),
                mathScale: options.svg && options.svg.mathScale || 0.0015,
                fixedScale: options.svg && options.svg.fixedScale ? options.svg.fixedScale: false,
                escapeClipping: !!(options.svg && options.svg.escapeClipping),
                defaultAlignment: options.svg && options.svg.defaultAlignment || 'C'
            },
            fragments: {
                enabled: (options.fragments && options.fragments.enabled) !== false,
                resetIndicesAfterTypeset: (options.fragments && options.fragments.resetIndicesAfterTypeset) !== false,
                cssIndices: (options.fragments && options.fragments.cssIndices) !== false,
                maxFragments: options.fragments && options.fragments.maxFragments || 20
            },
            mathjaxUrl: options.mathjaxUrl || 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.0/es5/tex-svg-full.min.js',
            macros: options.macros || {},
            mathDelimiters: options.mathDelimiters || [["\\(", "\\)"]],
            displayMathDelimiters: options.displayMathDelimiters || [["\\[", "\\]"]],
            preamble: options.preamble || false,
        };

        window.MathJax = {
            options: {
                renderActions: {
                    addMenu: [0, '', '']
                },
                skipHtmlTags: [
                    "svg",
                    "script",
                    "noscript",
                    "style",
                    "textarea",
                    "pre",
                    "code"
                ]
            },
            startup: {
                typeset: false,
                ready: () => {
                    MathJax.startup.defaultReady();
                    reveal.typesetMath();
                }
            },
            svg: {
                fontCache: "none",
                mtextInheritFont: (options.mtextInheritFont === true)
            },
            tex: {
                inlineMath: options.mathDelimiters,
                displayMath: options.displayMathDelimiters,
                macros: {
                    zoomable: ["\\class{zoomable}{#1}", 1],
                }
            }
        };

        Object.assign(window.MathJax.tex.macros, options.macros);

        if(options.fragments.enabled){
            Object.assign(window.MathJax.tex.macros, {
                fragidx: ["\\class{fragment revealmathfragidx-#1}{#2}", 2],
                sfragidx: ["\\class{fragment fade-in-then-semi-out revealmathfragidx-#1}{#2}", 2],
                vfragidx: ["\\rlap{\\class{fragment fade-in-then-out revealmathfragidx-#1}{#2}}", 2],
                next: ["\\class{fragment}{#1}", 1],
                step: ["\\class{fragment fade-in-then-semi-out}{#1}", 1],
                vstep: ["\\rlap{\\class{fragment fade-in-then-out}{#1}}", 1]
            });
        }

        function typesetMathInSVG() {
            function replaceText(textNode, svgMath, textNodeContainer, justification) {
                let svgMathMetrics = {
                    width: svgMath.viewBox.baseVal.width,
                    height: svgMath.viewBox.baseVal.height
                };

                let fontSize = textNode.getAttribute('font-size') || textNode.style.fontSize;
                fontSize = fontSize ? +(fontSize.replace('px', '')) : 20;

                let scale = options.svg.fixedScale || options.svg.mathScale * fontSize;

                let x = +textNode.getAttribute('x');
                if (textNode.hasAttribute('dx'))
                    x += textNode.getAttribute('dx');

                let y = +textNode.getAttribute('y');
                if (textNode.hasAttribute('dy'))
                    y += textNode.getAttribute('dy');

                let x0 = x;
                let y0 = y;
                let x1;

                justification = justification || 'L';
                switch(justification) {
                    case 'L': x1 = 0; break;
                    case 'R': x1 = -svgMathMetrics.width; break;
                    default:  x1 = -svgMathMetrics.width * 0.5; break;
                }
                let y1 = 0;//-svgMathMetrics.height * 0.25;

                let gnode = svgMath.querySelector('g').cloneNode(true);
                gnode.setAttribute('transform', 'translate('+x0+' '+y0+')'
                    +' scale('+scale+') translate('+x1+' '+y1+')'
                    +' matrix(1 0 0 -1 0 0)');

                let defaultStyle = {
                    'fill': '#000000',
                    'stroke': '#000000',
                    'fill-opacity': '1'
                };
                for(let property of ['fill', 'stroke', 'fill-opacity']){
                    let value = textNode.getAttribute(property) || textNode.style.getPropertyValue(property) || defaultStyle[property];
                    if(value){
                        gnode.style.setProperty(property, value);
                        for(let g of gnode.querySelectorAll('g,path')){
                            g.style.setProperty(property, value);
                        }
                    }
                }

                if(options.svg.escapeClipping) {
                    textNode.parentNode.removeAttribute('clip-path');
                }
                textNode.parentNode.removeChild(textNode);
                textNodeContainer.appendChild(gnode);
            }

            function typeset(textNode, textNodeContainer) {
                let regexp = /^\s*([LCR]?)\\\((.*)\\\)\s*$/i;
                let regexpDisplay = /^\s*([LCR]?)\\\[(.*)\\]\s*$/i;
                let math = textNode.textContent.match(regexp);
                let displayMath = textNode.textContent.match(regexpDisplay);
                let isDisplay = false;
                if(displayMath){
                    isDisplay = true;
                    math = displayMath;
                }

                if(math) {
                    let textAlignment = math[1].toUpperCase() || options.svg.defaultAlignment;
                    let mathMarkup = math[2];
                    let svg = MathJax.tex2svg(
                        mathMarkup,
                        MathJax.getMetricsFor(textNode, isDisplay)
                    ).querySelector('svg');
                    replaceText(textNode, svg, textNodeContainer, textAlignment);
                }
            }

            for(let text of document.querySelectorAll('svg text')) {
                let tspans = text.getElementsByTagName('tspan');
                for(let tspan of tspans) {
                    for(let coord of ['x', 'y'])
                        if(!tspan.hasAttribute(coord))
                            tspan.setAttribute(coord, tspan.parentElement.getAttribute(coord));
                    for(let attrName of ['font-size', 'stroke', 'fill', 'fill-opacity']) {
                        if(!(tspan.hasAttribute(attrName) || tspan.style.getPropertyValue(attrName))) {
                            tspan.style.setProperty(
                                attrName,
                                tspan.parentElement.getAttribute(attrName) ||  tspan.parentElement.style.getPropertyValue(attrName)
                           );
                        }
                    }
                    typeset(tspan, text.parentElement);
                }

                if(tspans.length === 0) {
                    typeset(text, text.parentElement);
                }
            }
        }


        function typesetMath() {
            if(options.preamble){
                let span = document.createElement('span');
                span.style.display = 'none';
                document.body.appendChild(span);
                let script = document.querySelector(options.preamble);
                span.innerText = script ? script.innerText : options.preamble;
                MathJax.typeset([span]);
                delete span;
            }

            MathJax.typeset();
            if(options.svg.enabled) {
                typesetMathInSVG();
            }

            for(let fragment of document.querySelectorAll( 'mjx-assistive-mml .fragment' ))
                fragment.classList.remove('fragment')

            if(options.fragments.resetIndicesAfterTypeset || options.fragments.cssIndices) {
                for(let slide of reveal.getSlides()){
                    for(let i = 1; i < options.fragments.maxFragments; ++i) {
                        let fragments = slide.querySelectorAll('.fragment.revealmathfragidx-' + i.toString() + ',.fragment.fragidx-' + i.toString());
                        if(i === 1 && (fragments.length > 0 || options.fragments.resetIndicesAfterTypeset)){
                            for(let fragment of slide.querySelectorAll('.fragment'))
                                if (fragment.hasAttribute('data-fragment-index'))
                                    fragment.removeAttribute('data-fragment-index');
                        }
                        if(fragments.length === 0)
                            break;
                        for(let fragment of fragments)
                            fragment.setAttribute('data-fragment-index', i);
                    }
                }
            }
            reveal.layout();
        }

        reveal.typesetMath = typesetMath;

        let mathJaxScript = document.createElement('script');
        mathJaxScript.src = options.mathjaxUrl;
        mathJaxScript.async = true;
        document.head.appendChild(mathJaxScript);

        return true;
    }
};

// Reveal.registerPlugin( 'revealMath', RevealMath );

// export default () => RevealMath;