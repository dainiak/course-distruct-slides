/*
    Live webcam picture-in-picture plugin for reveal.js.
    Inspired by: http://vxlabs.com/2013/10/11/impress-js-with-embedded-live-webcam/
    Plugin author: Alex Dainiak
    Web: https://github.com/dainiak
    Email: dainiak@gmail.com
 */

const RevealWebcam = {
    id: 'webcam',
    init: (reveal) => {
        let revealViewport = reveal.getViewportElement();

        let options = reveal.getConfig().webcam || {};
        if(typeof options.fullscreenHorizontalPadding !== 'number')
            options.fullscreenHorizontalPadding = 20;
        if(typeof options.fullscreenVerticalPadding !== 'number')
            options.fullscreenVerticalPadding = 20;
        options.fullscreenOpacity = options.fullscreenOpacity || 1.0;
        options.shrinkOnOverview = options.shrinkOnOverview !== false;
        options.keyToggle = options.keyToggle || 'c';
        options.keyFullscreen = options.keyFullscreen || 'C';

        let currentlyFullscreen = false;
        let currentlyHidden = false;

        let video = document.createElement('video');
        video.classList.add('webcam');
        video.classList.add('permanent');
        video.style.left = '20px';
        video.style.top = '20px';
        video.style.height = '100px';
        video.style.position = 'absolute';
        video.style.zIndex = '100';
        video.style.transition = '0.5s ease';
        video.style.opacity = '0.3';
        reveal.getViewportElement().appendChild(video);


        function shrinkWebcamVideo(videoElement) {
            if (!currentlyHidden && videoElement.hasAttribute('data-webcam-old-opacity'))
                videoElement.style.opacity = videoElement.getAttribute('data-webcam-old-opacity');
            if (videoElement.hasAttribute('data-webcam-old-left'))
                videoElement.style.left = videoElement.getAttribute('data-webcam-old-left');
            if (videoElement.hasAttribute('data-webcam-old-right'))
                videoElement.style.right = videoElement.getAttribute('data-webcam-old-right');
            if (videoElement.hasAttribute('data-webcam-old-top'))
                videoElement.style.top = videoElement.getAttribute('data-webcam-old-top');
            if (videoElement.hasAttribute('data-webcam-old-bottom'))
                videoElement.style.bottom = videoElement.getAttribute('data-webcam-old-bottom');
            if (videoElement.hasAttribute('data-webcam-old-width'))
                videoElement.style.width = videoElement.getAttribute('data-webcam-old-width');
            if (videoElement.hasAttribute('data-webcam-old-height'))
                videoElement.style.height = videoElement.getAttribute('data-webcam-old-height');
        }

        function expandWebcamVideo(videoElement) {
            let viewportWidth = revealViewport.clientWidth;
            let viewportHeight = revealViewport.clientHeight;

            let videoHeight = videoElement.videoHeight;
            let videoWidth = videoElement.videoWidth;
            // If video size is completely specified by user take this as canonical video dimensions
            if (videoElement.style.width && videoElement.style.height) {
                videoHeight = parseInt(videoElement.style.height);
                videoWidth = parseInt(videoElement.style.width);
            }

            let wRatio = (videoWidth + 2 * options.fullscreenHorizontalPadding) / viewportWidth;
            let hRatio = (videoHeight + 2 * options.fullscreenVerticalPadding) / viewportHeight;

            if (!currentlyHidden) {
                if (!videoElement.hasAttribute('data-webcam-old-opacity')) {
                    videoElement.setAttribute('data-webcam-old-opacity', videoElement.style.opacity);
                }
                videoElement.style.opacity = options.fullscreenOpacity;
            }

            let newVideoWidth, newVideoHeight, horizontalPadding, verticalPadding;
            if (wRatio > hRatio) {
                newVideoWidth = Math.round(viewportWidth - 2 * options.fullscreenHorizontalPadding);
                newVideoHeight = Math.round(newVideoWidth * videoHeight / videoWidth);
                horizontalPadding = options.fullscreenHorizontalPadding;
                verticalPadding = Math.round(0.5 * (viewportHeight - newVideoHeight));
            } else {
                newVideoHeight = Math.round(viewportHeight - 2 * options.fullscreenVerticalPadding);
                newVideoWidth = Math.round(newVideoHeight * videoWidth / videoHeight);
                horizontalPadding = Math.round(0.5 * (viewportWidth - newVideoWidth));
                verticalPadding = options.fullscreenVerticalPadding;
            }

            if (videoElement.style.height) {
                videoElement.setAttribute('data-webcam-old-height', videoElement.style.height);
                videoElement.style.height = newVideoHeight.toString() + 'px';
            }
            if (videoElement.style.width) {
                videoElement.setAttribute('data-webcam-old-width', videoElement.style.width);
                videoElement.style.width = newVideoWidth.toString() + 'px';
            }
            if (videoElement.style.top) {
                videoElement.setAttribute('data-webcam-old-top', videoElement.style.top);
                videoElement.style.top = verticalPadding.toString() + 'px';
            } else {
                videoElement.setAttribute('data-webcam-old-bottom', videoElement.style.bottom);
                videoElement.style.bottom = verticalPadding.toString() + 'px';
            }
            if (videoElement.style.left) {
                videoElement.setAttribute('data-webcam-old-left', videoElement.style.left);
                videoElement.style.left = horizontalPadding.toString() + 'px';
            } else {
                videoElement.setAttribute('data-webcam-old-right', videoElement.style.right);
                videoElement.style.right = horizontalPadding.toString() + 'px';
            }
        }

        reveal.addEventListener('ready', function () {
            if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
                console.warn("Couldn't retrieve webcam video: feature unsupported by your browser");
                return;
            }
            navigator.mediaDevices.getUserMedia({video: true}).then(function (localMediaStream) {
                let webcamContainers = revealViewport.querySelectorAll('video.webcam');
                for (let i = 0; i < webcamContainers.length; ++i) {
                    webcamContainers[i].srcObject = localMediaStream;
                    webcamContainers[i].setAttribute('autoplay', 'true');
                    webcamContainers[i].setAttribute('data-autoplay', 'true');
                }

                //Create permanent webcam
                let permanentCam = revealViewport.querySelector('video.webcam.permanent');
                if (permanentCam) {
                    permanentCam.srcObject = localMediaStream;
                    permanentCam.setAttribute('autoplay', 'true');
                    if (options.shrinkOnOverview) {
                        reveal.addEventListener('overviewshown', function () {
                            if (currentlyFullscreen && !currentlyHidden) {
                                shrinkWebcamVideo(permanentCam);
                                currentlyFullscreen = false;
                            }
                        });
                    }

                    document.addEventListener('keydown', function (event) {
                        if (document.querySelector(':focus') !== null || event.altKey || event.ctrlKey || event.metaKey)
                            return;

                        let config = reveal.getConfig();
                        if(config.keyboardCondition === "focused" && ! reveal.isFocused())
                            return true;
                        if(config.keyboardCondition === 'function' && config.keyboardCondition(event) === false ) {
                            return true;
                        }

                        if (event.key === options.keyToggle || event.key === options.keyFullscreen) {
                            event.preventDefault();

                            if (event.key === options.keyFullscreen) {
                                if (currentlyFullscreen) {
                                    shrinkWebcamVideo(permanentCam);
                                    currentlyFullscreen = false;
                                } else {
                                    expandWebcamVideo(permanentCam);
                                    currentlyFullscreen = true;
                                }
                            } else {
                                if (!currentlyHidden) {
                                    if (!permanentCam.hasAttribute('data-webcam-old-opacity')) {
                                        permanentCam.setAttribute('data-webcam-old-opacity', permanentCam.style.opacity);
                                    }

                                    permanentCam.style.opacity = '0';
                                    currentlyHidden = true;
                                } else {
                                    if (currentlyFullscreen)
                                        permanentCam.style.opacity = options.fullscreenOpacity;
                                    else
                                        permanentCam.style.opacity = permanentCam.getAttribute('data-webcam-old-opacity');

                                    currentlyHidden = false;
                                }
                            }
                        }
                    }, false);
                }
            }).catch(
                function (err) {
                    console.warn(err);
                }
            );
        });
    }
};

// export default () => RevealWebcam;