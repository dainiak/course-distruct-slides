let RevealMath = window.RevealMath || (function() {
	let options = Reveal.getConfig().math || {};
    options = {
        svgMathScale: options.svgMathScale || 0.0015,
        svgMathFixedScale: !!(options.svgMathFixedScale),
        svgMathEscapeClipping: !!(options.svgMathEscapeClipping),
        mathjaxUrl: options.mathjaxUrl || 'https://cdn.jsdelivr.net/npm/mathjax@3.0.5/es5/tex-svg-full.js',
        resetFragmentIndicesAfterTypeset: options.resetFragmentIndicesAfterTypeset !== false,
        fragmentIndexCSS: options.fragmentIndexCSS !== false,
        macros: options.macros || {},
        svgMathEnabled: !!(options.svgMathEnabled),
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
                // Hotfix for glitch with MathJax 3.0.5 SVG rendering
                if (MathJax.version === '3.0.5') {
                    const SVGWrapper = MathJax._.output.svg.Wrapper.SVGWrapper;
                    const CommonWrapper = SVGWrapper.prototype.__proto__;
                    SVGWrapper.prototype.unicodeChars = function (text, variant) {
                        if (!variant){
                            variant = this.variant || 'normal';
                        }
                        return CommonWrapper.unicodeChars.call(this, text, variant);
                    }
                }
                MathJax.startup.defaultReady();
                window.Reveal.typesetMath();
            }
        },
        svg: {
            fontCache: "none",
            mtextInheritFont: (options.mtextInheritFont === true)
        },
        tex: {
            inlineMath: [["\\(", "\\)"]],
            displayMath: [["\\[", "\\]"]],
            macros: {
                bbA: "{\\mathbb{A}}",
                bbB: "{\\mathbb{B}}",
                bbF: "{\\mathbb{F}}",
                bbN: "{\\mathbb{N}}",
                bbP: "{\\mathbb{P}}",
                bbQ: "{\\mathbb{Q}}",
                bbR: "{\\mathbb{R}}",
                bbZ: "{\\mathbb{Z}}",
                calA: "{\\mathcal{A}}",
                calB: "{\\mathcal{B}}",
                calC: "{\\mathcal{C}}",
                calD: "{\\mathcal{D}}",
                calF: "{\\mathcal{F}}",
                calG: "{\\mathcal{G}}",
                calI: "{\\mathcal{I}}",
                calM: "{\\mathcal{M}}",
                calN: "{\\mathcal{N}}",
                calO: "{\\mathcal{O}}",
                calR: "{\\mathcal{R}}",
                calS: "{\\mathcal{S}}",
                bfA: "{\\mathbf{A}}",
                bfa: "{\\mathbf{a}}",
                bfb: "{\\mathbf{b}}",
                bfc: "{\\mathbf{c}}",
                bfe: "{\\mathbf{e}}",
                bfw: "{\\mathbf{w}}",
                bfx: "{\\mathbf{x}}",
                bfy: "{\\mathbf{y}}",
                bfz: "{\\mathbf{z}}",
                floor: ["{\\left\\lfloor #1 \\right\\rfloor}", 1],
                ceil: ["{\\left\\lceil #1 \\right\\rceil}", 1],
                le: "\\leqslant",
                ge: "\\geqslant",
                hat: "\\widehat",
                emptyset: "\\varnothing",
                epsilon: "\\varepsilon",
                fragidx: ["\\class{fragment fragidx-#1}{#2}", 2],
                sfragidx: ["\\class{fragment fade-in-then-semi-out fragidx-#1}{#2}", 2],
                vfragidx: ["\\rlap{\\class{fragment fade-in-then-out fragidx-#1}{#2}}", 2],
                underbracket: ["\\mathop{\\underset{\\mmlToken{mo}{⎵}}{#2}}\\limits_{#1}", 2],
                next: ["\\class{fragment}{#1}", 1],
                step: ["\\class{fragment fade-in-then-semi-out}{#1}", 1],
                vstep: ["\\rlap{\\class{fragment fade-in-then-out}{#1}}", 1],
                zoomable: ["\\class{zoomable}{#1}", 1],
                green: ["\\class{green}{#1}", 1],
                red: ["\\class{red}{#1}", 1]
            }
        }
    };

    Object.assign(window.MathJax.tex.macros, options.macros);

    function typesetMathInSVG() {
        function replaceText(textNode, svgMath, textNodeContainer, justification) {
            let svgMathMetrics = {
                width: svgMath.viewBox.baseVal.width,
                height: svgMath.viewBox.baseVal.height
            };

            let gnode = svgMath.querySelector('g').cloneNode(true);

            let fontSize = textNode.getAttribute('font-size') || textNode.style.fontSize;
            fontSize = fontSize ? +(fontSize.replace('px', '')) : "20";

            let scale = options.svgMathFixedScale || options.svgMathScale * fontSize;

            let x =  +textNode.getAttribute('x');
            if (textNode.hasAttribute('dx'))
                x += textNode.getAttribute('dx');

            let y =  +textNode.getAttribute('y');
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
            gnode.setAttribute('transform', 'translate('+x0+' '+y0+')'
                +' scale('+scale+') translate('+x1+' '+y1+')'
                +' matrix(1 0 0 -1 0 0)');

            let fill = textNode.getAttribute('fill') || textNode.style.fill || "rgb(0,0,0)";
            let stroke = textNode.getAttribute('stroke') || textNode.style.stroke || "rgb(0,0,0)";

            if(fill)
                gnode.style.fill = fill;
            if(stroke)
                gnode.style.stroke = stroke;

            if (options.svgMathEscapeClipping)
                textNode.parentNode.removeAttribute('clip-path');
            textNode.parentNode.removeChild(textNode);
            textNodeContainer.appendChild(gnode);
        }

        function typeset(textNode, textNodeContainer) {
            let regexp = /^\s*([LCRlcr]?)\\\((.*)\\\)\s*$/;
            let regexpDisplay = /^\s*([LCRlcr]?)\\\[(.*)\\]\s*$/;
            let math = textNode.textContent.match(regexp);
            let displayMath = textNode.textContent.match(regexpDisplay);
            let display = false;
            if(displayMath){
                display = true;
                math = displayMath;
            }

            if (math) {
                let justification = math[1].toUpperCase();
                let mathmarkup = math[2];

                let svg = MathJax.tex2svg(
                    mathmarkup,
                    {
                        display: display
                    }
                ).querySelector('svg');
                replaceText(textNode, svg, textNodeContainer, justification);
            }
        }

        for(let text of document.querySelectorAll('svg > text')) {
            let tspans = text.getElementsByTagName('tspan');
            for(let tspan of tspans) {
                for(let coord of ['x', 'y'])
                    if(!tspan.hasAttribute(coord))
                        tspan.setAttribute(coord, tspan.parentElement.getAttribute(coord));
                for(let attrName of ['font-size', 'stroke', 'fill']) {
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
        if(options.svgMathEnabled) {
            typesetMathInSVG();
        }
        MathJax.typeset();
        for(let fragment of document.querySelectorAll( 'mjx-assistive-mml .fragment' ))
            fragment.classList.remove('fragment')

        if(options.resetFragmentIndicesAfterTypeset || options.fragmentIndexCSS) {
            for(let slide of Reveal.getSlides()){
                for(let fragment of slide.querySelectorAll('.fragment'))
                    if (fragment.hasAttribute('data-fragment-index'))
                        fragment.removeAttribute('data-fragment-index');

                for(let i = 0; i < 15; ++i) {
                    let fragments = slide.querySelectorAll('.fragment.fragidx-' + i.toString());
                    if(fragments.length === 0 && i >= 1)
                        break;
                    for(let fragment of fragments)
                        fragment.setAttribute('data-fragment-index', i);
                }
            }
        }
        Reveal.layout();
    }


    Reveal.typesetMath = typesetMath;

    let mathJaxScript = document.createElement('script');
    mathJaxScript.src = options.mathjaxUrl;
    mathJaxScript.async = true;
    document.head.appendChild(mathJaxScript);

    return true;
})();

Reveal.registerPlugin( 'math', RevealMath );
