/*
 * external.js
 * Jan Schoepke <janschoepke@me.com>
 * Released under the MIT license
 * Load external files into a reveal.js presentation.
 *
 * This is a reveal.js plugin to load external html files. It replaces the
 * content of any element with a data-external="file.ext#selector" with the contents
 * part of file.ext specified by the selector. If you use
 * data-external-replace="file.ext#selector" the container element itself will get
 * replaced.
 *
 * Relative paths in "src" attributes in the loaded fragments will get prefixed
 * with the path.
 *
 * external: {
 *   async: false,
 *   mapAttributes: ['src']
 * }
 *
 * This started life as markdown.js. Thank you to whomever wrote it.
 * This version is based on external.js by Cal Evans. Thanks Cal!
 * Thanks to Thomas Weinert (https://github.com/ThomasWeinert) for massive improvements in version 1.3!
 */
const RevealExternal = {
    id: 'external',
    init: (reveal) => {
        "use strict";

        let config = reveal.getConfig() || {}, options;
        config.external = config.external || {};
        options = {
            /*
              Some plugins run into problems, because they expect to have access
              to the all of the slides. Enable on your own risk.
             */
            async: !!config.external.async,
            /*
              This will prefix the attributes (by default "src") in the loaded
              HTML with the path if they are relative paths (start with a dot).
             */
            mapAttributes: config.external.mapAttributes instanceof Array
                ? config.external.mapAttributes
                : (config.external.mapAttributes ? ['src'] : [])
        };

        let getTarget = function (node) {
            let url, isReplace;
            url = node.getAttribute('data-external') || '';
            isReplace = false;
            if (url === '') {
                url = node.getAttribute('data-external-replace') || '';
                isReplace = true;
            }
            if (url.length > 0) {
                let r = url.match(/^([^#]+)(?:#(.+))?/);
                return {
                    url: r[1] || "",
                    fragment: r[2] || "",
                    isReplace: isReplace
                };
            }
            return null;
        };

        let convertUrl = function (src, path) {
            if (path !== '' && src.indexOf('.') === 0) {
                return path + '/' + src;
            }
            return src;
        };

        let convertAttributes = function (attributeName, container, path) {
            if (!(container instanceof Element)) {
                return;
            }
            let nodes = container.querySelectorAll('[' + attributeName + ']');


            if (container.getAttribute(attributeName)) {
                container.setAttribute(
                    attributeName,
                    convertUrl(container.getAttribute(attributeName), path)
                );
            }
            for (let node of nodes) {
                node.setAttribute(
                    attributeName,
                    convertUrl(node.getAttribute(attributeName), path)
                );
            }
        };

        let convertUrls = function (container, path) {
            for (let attributeName of options.mapAttributes) {
                convertAttributes(attributeName, container, path);
            }
        };

        let updateSection = function (section, target, path) {
            let url = path !== "" ? (path + "/" + target.url) : target.url;
            let xhr = new XMLHttpRequest();

            xhr.onreadystatechange = function (xhr, target, url, fragment, replace) {
                return function () {
                    let nodes, path;
                    if (xhr.readyState !== 4) {
                        return;
                    }
                    if (!
                        ((xhr.status >= 200 && xhr.status < 300) ||
                            (xhr.status === 0 && xhr.responseText !== '')
                        )) {
                        console.log(
                            'ERROR: The attempt to fetch ' + url +
                            ' failed with HTTP status ' + xhr.status + '.'
                        );

                        return;
                    }

                    path = url.substr(0, url.lastIndexOf("/"));
                    let html = (new DOMParser).parseFromString(
                        xhr.responseText, 'text/html'
                    );
                    if (fragment !== '') {
                        nodes = html.querySelectorAll(fragment);
                    } else {
                        nodes = html.querySelector('body').childNodes;
                    }
                    if (!replace) {
                        target.innerHTML = '';
                    }
                    for (let node of nodes) {
                        convertUrls(node, path);
                        // Usage example:
                        // <svg class="fragment" data-external-replace="myfile.svg#svg"></svg>
                        if (nodes.length == 1 && replace) {
                            for (let cssClass of target.classList) {
                                node.classList.add(cssClass);
                            }
                        }

                        node = document.importNode(node, true);
                        if (replace) {
                            target.parentNode.insertBefore(node, target)
                        } else {
                            target.appendChild(node);
                        }

                        if (options.async) {
                            reveal.sync();
                            reveal.setState(reveal.getState());
                        }

                        if (node instanceof Element) {
                            loadExternal(node, path);
                        }
                    }
                    if (replace) {
                        target.parentNode.removeChild(target);
                    }
                };
            }(xhr, section, url, target.fragment, target.isReplace);

            xhr.open("GET", url, options.async);
            try {
                xhr.send();
            } catch (e) {
                console.log(
                    'Failed to get the file ' + url +
                    '. Make sure that the presentation and the file are served by a ' +
                    'HTTP server and the file can be found there. ' + e
                );
            }
        };

        function loadExternal(container, path) {
            path = typeof path === "undefined" ? "" : path;
            if (
                container instanceof Element &&
                (
                    container.getAttribute('data-external') ||
                    container.getAttribute('data-external-replace')
                )
            ) {
                let target = getTarget(container);
                if (target) {
                    updateSection(container, target, path);
                }
            } else {
                for (let section of container.querySelectorAll('[data-external], [data-external-replace]')) {
                    let target = getTarget(section);
                    if (target) {
                        updateSection(section, target, path);
                    }
                }
            }
        }

        loadExternal(reveal.getViewportElement());
    }
};

// Reveal.registerPlugin( 'revealExternal', RevealExternal );

// export default () => RevealExternal;