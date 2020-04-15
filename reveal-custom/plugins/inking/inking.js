/*
    Inking plugin for reveal.js

    Plugin author: Alex Dainiak, Assoc. Prof. at Moscow Institute of Physics and Technology: https://mipt.ru/english/
    Web: wwww.dainiak.com
    Email: dainiak@gmail.com

    Plugin development was supported by a Vladimir Potanin Foundation grant: http://english.fondpotanin.ru/

    The plugin is powered by:
        Reveal.js:   https://github.com/hakimel/reveal.js     (MIT license)
        Fabric.js:   https://github.com/kangax/fabric.js      (MIT license)
        MathJax:     https://github.com/mathjax/MathJax       (Apache-2.0 license)
*/

let RevealInking = window.RevealInking || (function (){
    let options = Reveal.getConfig().inking || {};

    let RENDERING_RESOLUTION = options.renderingResolution || 1;
    let CANVAS_ABOVE_CONTROLS = !!(options.canvasAboveControls);

    let CONTROLS_VISIBLE = options.controls !== false;
    options.controls = options.controls || {};
    let CONTROLS_COLOR = options.controls.color || 'rgb(0,0,0)';
    let CONTROLS_SHADOW = options.controls.shadow || '0 0 5px black';
    let CONTROLS_OPACITY = options.controls.opacity || 1;

    options.ink = options.ink || {};
    let INK_COLORS = options.ink.color || ['rgb(250,250,250)','rgb(250,0,0)','rgb(0,250,0)','rgb(0,0,250)'];
    let CURRENT_INK_COLOR = Array.isArray(INK_COLORS) ? INK_COLORS[0] : INK_COLORS;
    let INK_SHADOW = options.ink.shadow !== undefined ? options.inkShadow : 'rgb(50,50,50)';

    let MATH_ENABLED = options.math !== false;
    options.math = options.math || {};
    let MATH_COLOR = options.math.color || 'rgb(250,250,250)';
    let MATH_SHADOW = options.math.shadow || false;
    let DISPLAY_STYLE_MATH = options.math.displayStyle !== false;
    let MATH_MACROS = options.math.macros || [];

    let SPOTLIGHT_ENABLED = options.spotlight !== false;
    options.spotlight = options.spotlight || {};
    let SPOTLIGHT_BACKGROUND_OPACITY = options.spotlight.backgroundOpacity || 0.5;
    let SPOTLIGHT_RADIUS = options.spotlight.radius || 100;

    let PREDEFINED_CANVAS_CONTENT = options.inkingCanvasContent;
    let mousePosition = {};

    let canvasVisibleBeforeRevealOverview = null;

    options.hotkeys = options.hotkeys || {};
    let HOTKEYS = {
        DRAW: options.hotkeys.draw || 'Control',
        ERASE: options.hotkeys.erase || 'Shift',
        TOGGLE_CANVAS: options.hotkeys.toggleCanvas || 'q',
        INSERT_FORMULA: options.hotkeys.insertMath || '=',
        DELETE_SELECTED: options.hotkeys.delete || 'Delete',
        CLEAR: options.hotkeys.clear || '-',
        SERIALIZE_CANVAS: options.hotkeys.serializeCanvas || 'z',
        SPOTLIGHT: options.hotkeys.spotlight || 'x'
    };

    let currentImage = null;
    let isInEraseMode = false;
    let isMouseLeftButtonDown = false;
    let formulaRenderingDiv = null;
    let spotlight = null;
    let spotlightBackground = null;

    let scriptsToLoad = [
        {
            content: '.ink-controls {position: fixed;bottom: 10px;right: 200px;cursor: default;'
                + (CONTROLS_COLOR ? 'color: ' + CONTROLS_COLOR + ';' : '')
                + (CONTROLS_VISIBLE ? '' : 'display: none;')
                + (CONTROLS_OPACITY ? 'opacity: ' + CONTROLS_OPACITY + ';' : '')
                + 'z-index: 130;}'
                + '.ink-control-button {float: left;display: inline;font-size: 20pt;padding-left: 10pt; padding-right: 10pt;}'
                + '.ink-color:before {content: "\u25A0"} '
                + '.ink-pencil:before {content: "\u270E"} '
                + '.ink-erase:before {content: "\u2421"} '
                + '.ink-formula:before {content: "\u2211"} '
                + '.ink-clear:before {content: "\u239A"} '
                + '.ink-hidecanvas:before {content: "\u22A0"} '
                + '.ink-serializecanvas:before {content: "\u2B07"} ',
            type: 'text/css'
        }, {
            url: 'https://cdn.jsdelivr.net/npm/fabric@4.0.0-beta.10/dist/fabric.min.js',
            condition: !window.fabric
        },
        {
            url: 'https://cdn.jsdelivr.net/npm/mathjax@3.0.5/es5/tex-svg-full.js',
            condition: MATH_ENABLED && !window.MathJax
        }
    ];

    loadScripts(scriptsToLoad, function () {
        // This is important for MathJax equations to serialize well into fabric.js
        fabric.Object.NUM_FRACTION_DIGITS = 5;

        let viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
        let viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
        let bottomPadding = 0;
        if (CANVAS_ABOVE_CONTROLS){
            bottomPadding = parseInt(window.getComputedStyle(document.querySelector('.controls')).height) + parseInt(window.getComputedStyle(document.querySelector('.controls')).bottom);
        }

        let canvasElement = document.querySelector('#revealjs_inking_canvas');
        if(!canvasElement) {
            canvasElement = document.createElement('canvas');
            canvasElement.id = 'revealjs_inking_canvas';
            canvasElement.width = viewportWidth;
            canvasElement.height = viewportHeight - bottomPadding;
            canvasElement.style.position = 'fixed';
            canvasElement.style.left = '0px';
            canvasElement.style.top = '0px';
            canvasElement.style.width = '100%';
            canvasElement.style.bottom = bottomPadding.toString() + 'px';
            canvasElement.style.zIndex = window.getComputedStyle(document.querySelector('.controls')).zIndex;
            document.body.appendChild(canvasElement);
        }

        let canvas = new fabric.Canvas(canvasElement, {
            perPixelTargetFind: true,
            renderOnAddRemove: true
        });

        window.addEventListener('load', function(event) {
            if(PREDEFINED_CANVAS_CONTENT) {
                for(let c of PREDEFINED_CANVAS_CONTENT) {
                    let slide;
                    if(c.slideId) {
                        slide = document.getElementById(c.slideId);
                    }
                    else if(c.slideNumber) {
                        let slides = document.querySelectorAll('.reveal .slides section');
                        if(slides && c.slideNumber < slides.length) {
                            slide = slides[c.slideNumber];
                        }
                    }
                    if(slide && !slide.dataset.inkingCanvasContent && c.inkingCanvasContent) {
                        slide.dataset.inkingCanvasContent = JSON.stringify(c.inkingCanvasContent);
                    }
                }
            }
            for(let slide of document.querySelectorAll('section[data-inking-canvas-content]')) {
                if(slide.dataset.inkingCanvasContent && slide.dataset.inkingCanvasContent.toLowerCase().endsWith('.svg')){
                    fabric.loadSVGFromURL(
                        slide.dataset.inkingCanvasContent,
                        function (objects) {
                            let s = [];
                            for(let obj of objects) {
                                s.push(obj.toObject());
                            }
                            slide.dataset.inkingCanvasContent = JSON.stringify({
                               objects: s
                            });
                        }
                    );
                }
            }


            let slide = Reveal.getCurrentSlide();
            canvas.clear();
            if(slide.dataset.inkingCanvasContent){
                setTimeout(function(){
                    canvas.loadFromJSON(slide.dataset.inkingCanvasContent);
                }, parseInt(window.getComputedStyle(slide).transitionDuration) || 800);
            }
        });

        Reveal.addEventListener('slidechanged',function(event){
            destroySpotlight();
            let objects = canvas.getObjects();
            if(objects.length > 0) {
                event.previousSlide.dataset.inkingCanvasContent = JSON.stringify(canvas);
            }

            let slide = event.currentSlide;
            canvas.clear();
            if(slide.dataset.inkingCanvasContent){
                setTimeout(function(){
                    canvas.loadFromJSON(slide.dataset.inkingCanvasContent);
                    for(let obj of canvas.getObjects()){
                        obj.set({
                            hasControls: true,
                            hasBorders: true,
                            lockScalingFlip: true,
                            centeredScaling: true,
                            lockUniScaling: true,
                            hasRotatingPoint: false
                        });
                    }
                }, parseInt(window.getComputedStyle(slide).transitionDuration) || 800);
            }
            leaveDeletionMode();
        });

        canvas.on('mouse:move', function(options) {
            mousePosition.x = options.e.layerX;
            mousePosition.y = options.e.layerY;
            if(spotlight) {
                spotlight.set({
                    left: mousePosition.x - spotlight.radius,
                    top: mousePosition.y - spotlight.radius
                });
                canvas.renderAll();
            }
        });

        canvas.on('object:added', function(evt){
            let obj = evt.target;
            obj.set({
                hasControls: true,
                hasBorders: true,
                lockScalingFlip: true,
                centeredScaling: true,
                lockUniScaling: true,
                hasRotatingPoint: false
            });
        });

        canvas.on('mouse:over', function(evt){
            if(isInEraseMode && isMouseLeftButtonDown) {
                canvas.remove(evt.target);
            }
        });

        function enterDeletionMode(){
            leaveDrawingMode();

            if(!isInEraseMode) {
                canvas.isDrawingMode = false;
                isInEraseMode = true;
                canvas.selection = false;
                document.querySelector('.ink-erase').style.textShadow = CONTROLS_SHADOW;
            }
        }
        function leaveDeletionMode(){
            if (isInEraseMode) {
                isInEraseMode = false;
                canvas.selection = true;
                document.querySelector('.ink-erase').style.textShadow = '';
            }
        }

        canvas.upperCanvasEl.style.position = 'fixed';
        canvas.lowerCanvasEl.style.position = 'fixed';
        canvas.freeDrawingBrush.width = 2;
        if(INK_SHADOW) {
            canvas.freeDrawingBrush.shadow = new fabric.Shadow({blur: 10, offsetX: 1, offsetY: 1, color: INK_SHADOW});
        }
        else{
            canvas.freeDrawingBrush.shadow = null;
        }

        canvas.targetFindTolerance = 3;

        function serializeCanvas(){
            function download(filename, text) {
                let element = document.createElement('a');
                element.style.display = 'none';

                element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
                element.setAttribute('download', filename);

                document.body.appendChild(element);
                element.click();
                document.body.removeChild(element);
            }

            destroySpotlight();

            let text, filename;
            if(confirm("Save current slide to SVG? (Press Cancel to save current or all slides to JSON.)")) {
                text = canvas.toSVG();
                filename = 'canvas.svg';
            }
            else {
                if(confirm("Save all slides content? (Press Cancel to save only the current slide.)")){
                    filename = 'all_slides.json';
                    if(canvas.getObjects().length > 0) {
                        Reveal.getCurrentSlide().dataset.inkingCanvasContent = JSON.stringify(canvas);
                    }
                    text = '[';
                    let slides = document.querySelectorAll('.reveal .slides section');
                    for(let slideNumber = 0; slideNumber < slides.length; ++slideNumber) {
                        let slide = slides[slideNumber];
                        let content = slide.dataset.inkingCanvasContent;
                        if(content) {
                            if(text.length > 2) {
                                text += ', ';
                            }
                            text +=
                                '{'
                                + (slide.id ? '"slideId": ' + JSON.stringify(slide.id) : '"slideNumber": ' + JSON.stringify(slideNumber))
                                + ', "inkingCanvasContent": ' + content +'}';
                        }
                    }
                    text += ']';
                }
                else{
                    filename = 'canvas.json';
                    text = JSON.stringify(canvas);
                }
            }
            download(filename, text);
        }

        document.addEventListener( 'keydown', function(event){
            if(SPOTLIGHT_ENABLED && event.key === HOTKEYS.SPOTLIGHT){
                if(spotlight){
                    destroySpotlight();
                }
                else{
                    if(!isCanvasVisible()) {
                        toggleCanvas();
                    }
                    createSpotlight();
                }
            }

            if(event.key === HOTKEYS.DRAW) {
                if(document.querySelector('.canvas-container').style.display == 'none')
                    return;

                enterDrawingMode();
            }
            if(event.key === HOTKEYS.ERASE){
                if(document.querySelector('.canvas-container').style.display == 'none')
                    return;

                enterDeletionMode();
                canvas.selection = false;
            }
            if(event.key === HOTKEYS.TOGGLE_CANVAS ) {
                toggleCanvas();
            }
            if(event.key === HOTKEYS.CLEAR) {
                canvas.clear();
            }
            if(event.key == HOTKEYS.SERIALIZE_CANVAS) {
                serializeCanvas();
            }
        });

        function createSpotlight(){
            if(!SPOTLIGHT_ENABLED) {
                return;
            }
            if(spotlight){
                destroySpotlight();
            }

            spotlight = new fabric.Circle({
                radius: SPOTLIGHT_RADIUS,
                left: mousePosition.x - SPOTLIGHT_RADIUS,
                top: mousePosition.y - SPOTLIGHT_RADIUS,
                hasControls: false,
                hasBorders: false,
                selectable: false,
                evented: false,
                fill: "white",
                cursor: "none",
                opacity: 1,
                globalCompositeOperation: 'destination-out',
            });
            spotlightBackground = new fabric.Rect({
                left: 0,
                top: 0,
                width: canvas.width,
                height: canvas.height,
                fill: "black",
                hasControls: false,
                hasBorders: false,
                evented: false,
                selectable: false,
                opacity: SPOTLIGHT_BACKGROUND_OPACITY
            });

            canvas.selection = false;
            canvas.defaultCursor = 'none';

            // document.body.style.cursor = 'none';
            canvas.add(spotlightBackground);
            canvas.add(spotlight);
            canvas.renderAll();
        }
        function destroySpotlight(){
            if(SPOTLIGHT_ENABLED && spotlight) {
                canvas.remove(spotlight);
                canvas.remove(spotlightBackground);
                spotlight = null;
                spotlightBackground = null;
                canvas.selection = true;
                canvas.defaultCursor = null;
                canvas.renderAll();
            }
        }

        canvas.on('mouse:down', function(options) {
            isMouseLeftButtonDown = true;
            mousePosition.x = options.e.layerX;
            mousePosition.y = options.e.layerY;
            if(SPOTLIGHT_ENABLED && options.e.altKey) {
                createSpotlight();
            }
            else {
                if(options.target && options.target.mathFormula) {
                    currentImage = options.target;
                }
            }
        });
        canvas.on('mouse:up', function(options) {
            isMouseLeftButtonDown = false;
            if(SPOTLIGHT_ENABLED && options.e.altKey) {
                destroySpotlight();
            }
        });

        canvas.on('selection:cleared', function() {
            if(currentImage){
                currentImage = null;
                currentFormula = '';
                document.querySelector('.ink-formula').style.textShadow = '';
            }
        });

        window.addEventListener( 'keyup', function(evt){
            if(evt.key === HOTKEYS.DRAW) {
                canvasElement.dispatchEvent(new MouseEvent('mouseup', {
                    'view': window,
                    'bubbles': true,
                    'cancelable': true
                }));
                leaveDrawingMode();
            }
            if(evt.key === HOTKEYS.ERASE) {
                leaveDeletionMode();
            }
            if(evt.key === HOTKEYS.DELETE_SELECTED) {
                if(canvas.getActiveObjects()) {
                    canvas.getActiveObjects().forEach(function (obj) {
                        canvas.remove(obj);
                    });
                    canvas.discardActiveObject().requestRenderAll();
                }
            }
        });


        if(MATH_ENABLED) {
            window.addEventListener( 'keyup', function(evt){
                if(document.querySelector('.canvas-container').style.display == 'none')
                    return;

                if(evt.key === HOTKEYS.INSERT_FORMULA) {
                    createNewFormulaWithQuery();
                }
            });
        }

        let controls = document.createElement( 'aside' );
		controls.classList.add( 'ink-controls' );

        let colorControls = '';

        if(Array.isArray(INK_COLORS)) {
            for(let color of INK_COLORS){
                color = color.trim();
                if(color) {
                    colorControls += '<div class="ink-color ink-control-button" style="color: ' + color + '"></div>';
                }
            }
        }

		controls.innerHTML =
              colorControls
            + '<div class="ink-pencil ink-control-button"></div>'
            + '<div class="ink-erase ink-control-button"></div>'
            + (MATH_ENABLED ? '<div class="ink-formula ink-control-button"></div>' : '')
			+ '<div class="ink-clear ink-control-button"></div>'
            + '<div class="ink-hidecanvas ink-control-button"></div>'
            + '<div class="ink-serializecanvas ink-control-button"></div>';
		document.body.appendChild( controls );
        function toggleColorChoosers(b) {
            for(let element of document.querySelectorAll('.ink-color')) {
                element.style.visibility = b ? 'visible' : 'hidden';
            }
        }

        toggleColorChoosers(false);
        document.querySelector('.canvas-container').oncontextmenu = function(){return false};

        for(let element of document.querySelectorAll('.ink-color')){
            element.onmousedown = function(event){
                let btn = event.target;
                CURRENT_INK_COLOR = btn.style.color;
                canvas.freeDrawingBrush.color = CURRENT_INK_COLOR;
                if(canvas.isDrawingMode) {
                    document.querySelector('.ink-pencil').style.textShadow = '0 0 10px ' + CURRENT_INK_COLOR;
                }
                btn.style.textShadow = '0 0 20px ' + btn.style.color;
                setTimeout( function(){btn.style.textShadow = '';}, 200 );
            };
        }

        document.querySelector('.ink-pencil').onclick = function(){
            toggleDrawingMode();
        };

        if(MATH_ENABLED){
            document.querySelector('.ink-formula').onclick = createNewFormulaWithQuery;
        }

        document.querySelector('.ink-clear').onmousedown = function(event){
            let btn = event.target;
            btn.style.textShadow = CONTROLS_SHADOW;
            setTimeout( function(){btn.style.textShadow = '';}, 200 );
            canvas.clear();
        };

        function isCanvasVisible(){
            let cContainer = document.querySelector('.canvas-container');
            return !(cContainer.style.display === 'none');
        }

        function toggleCanvas(on){
            let cContainer = document.querySelector('.canvas-container');
            if(on === undefined) {
                on = !isCanvasVisible();
            }

            if (on){
                document.querySelector('.ink-hidecanvas').style.textShadow = '';
                cContainer.style.display = 'block';
            }
            else {
                destroySpotlight();
                cContainer.style.display = 'none';
                document.querySelector('.ink-hidecanvas').style.textShadow = CONTROLS_SHADOW;
            }
        };

        document.querySelector('.ink-hidecanvas').onclick = function(){ toggleCanvas(); };

        document.querySelector('.ink-serializecanvas').onclick = function(){
            serializeCanvas();
        };

        Reveal.addEventListener('overviewshown', function (event) {
            canvasVisibleBeforeRevealOverview = isCanvasVisible();
            toggleCanvas(false);
        });

        Reveal.addEventListener('overviewhidden', function (event) {
            if(canvasVisibleBeforeRevealOverview) {
                canvasVisibleBeforeRevealOverview = false;
                toggleCanvas(true);
            }
        });

        document.querySelector('.ink-erase').onclick = function(){
            if (isInEraseMode){
                leaveDeletionMode();
            }
            else{
                enterDeletionMode();
            }
        };

        function toggleDrawingMode() {
            if (canvas.isDrawingMode) {
                leaveDrawingMode();
            }
            else {
                enterDrawingMode();
            }
        }
        function enterDrawingMode(){
            canvas.freeDrawingBrush.color = CURRENT_INK_COLOR;
            canvas.isDrawingMode = true;
            document.querySelector('.ink-pencil').style.textShadow = '0 0 10px ' + CURRENT_INK_COLOR;
            toggleColorChoosers(true);
        }
        function leaveDrawingMode() {
            canvas.isDrawingMode = false;
            document.querySelector('.ink-pencil').style.textShadow = '';
            toggleColorChoosers(false);
        }

        function createNewFormulaWithQuery(){
            let currentFormula = null;
            let currentMathColor = null;

            if(currentImage && canvas.getActiveObject() == currentImage){
                currentMathColor = currentImage.mathColor;
                currentFormula = currentImage.mathFormula;
            }

            let mathColor = (currentFormula && currentMathColor) || (MATH_COLOR === 'ink' ? CURRENT_INK_COLOR : MATH_COLOR);
            document.querySelector('.ink-formula').style.textShadow = '0 0 10px ' + mathColor;

            if(!formulaRenderingDiv) {
                formulaRenderingDiv = document.createElement('div');
                formulaRenderingDiv.style.position = 'fixed';
                formulaRenderingDiv.style.top = '0px';
                formulaRenderingDiv.style.left = '0px';
                formulaRenderingDiv.style.opacity = 0;
                formulaRenderingDiv.style.color = mathColor;
                document.body.appendChild(formulaRenderingDiv);
            }

            let currentFontSize = window.getComputedStyle(Reveal.getCurrentSlide()).fontSize.toString();
            formulaRenderingDiv.style.fontSize = currentFontSize.replace(/^\d+/, (RENDERING_RESOLUTION * parseInt(currentFontSize)).toString());

            let formula = prompt('Enter a formula', currentFormula || '');
            if(formula && formula.trim()) {
                formula = formula.trim();
                for(let mmacro of MATH_MACROS){
                    let rFrom = mmacro[0].replace(/[\\$^[{}()?.*|]/g, function($0){return '\\'+$0});
                    let rTo = mmacro[1];
                    formula = formula.replace( new RegExp( rFrom, 'g'), rTo );
                }

                let targetLeft =
                    currentImage
                        ? currentImage.left
                        : (mousePosition.x > 10 ? mousePosition.x : 10);
                let targetTop =
                    currentImage
                        ? currentImage.top
                        : (mousePosition.y > 10 ? mousePosition.y : 10);
                let targetAngle = currentImage ? currentImage.angle : null;
                let targetScaleX = currentImage ? currentImage.scaleX / currentImage.originalScaleX : null;
                let targetScaleY = currentImage ? currentImage.scaleY / currentImage.originalScaleY : null;

                if (currentImage) {
                    canvas.remove(currentImage);
                    currentImage = null;
                }

                formula = formula.trim();
                formulaRenderingDiv.innerHTML = '';
                let mjMetrics = MathJax.getMetricsFor(formulaRenderingDiv, DISPLAY_STYLE_MATH);
                formulaRenderingDiv.appendChild(MathJax.tex2svg(
                    formula,
                    mjMetrics
                ));
                let svg = formulaRenderingDiv.querySelector('mjx-container > svg');
                let svgString = formulaRenderingDiv.querySelector('mjx-container').innerHTML;

                fabric.loadSVGFromString(
                    svgString,
                    function(objects, options) {
                        for(let obj of objects){
                            obj.set({
                                fill: mathColor
                            });
                        }

                        let img = fabric.util.groupSVGElements(objects, options).setCoords();

                        img.scaleToHeight(
                            svg.height.baseVal.value
                        );

                        img.set({
                            'mathFormula': formula,
                            'mathColor': mathColor,
                            'originalScaleX': img.scaleX,
                            'originalScaleY': img.scaleY
                        });

                        if(targetScaleX) {
                            img.set({
                                scaleX: img.scaleX * targetScaleX,
                                scaleY: img.scaleY * targetScaleY,
                            });
                        }

                        if(targetAngle) {
                            img.set({
                                angle: targetAngle
                            });
                        }

                        img.set({
                            left: targetLeft,
                            top: targetTop,
                            lockScalingFlip: true,
                            hasRotatingPoint: false,
                            hasBorders: true,
                            centeredScaling: true
                        });

                        if (MATH_SHADOW) {
                            img.set('shadow', new fabric.Shadow({
                                blur: 10,
                                offsetX: 1,
                                offsetY: 1,
                                color: MATH_SHADOW === true ? 'rgba(0,0,0,1)' : MATH_SHADOW
                            }));
                        }

                        img.on('selected', function () {
                            if(canvas.getActiveObject() == img) {
                                currentImage = img;
                                document.querySelector('.ink-formula').style.textShadow = '0 0 10px ' + mathColor;
                            }
                        });

                        img.on('mousedblclick', function () {
                            currentImage = img;
                            createNewFormulaWithQuery();
                        });

                        canvas.add(img);
                        canvas.setActiveObject(img);
                    }
                );
            }
            else {
                document.querySelector('.ink-formula').style.textShadow = '';
            }
        }
    });


    function loadScript( params, extraCallback ) {
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
        if(!scripts || scripts.length == 0) {
            if (typeof callback === 'function') {
                if(Reveal.isReady()) {
                    callback.call();
                    callback = null;
                }
                else {
                    Reveal.addEventListener('ready', function () {
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

    return true;
})();