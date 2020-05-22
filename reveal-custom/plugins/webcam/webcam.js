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
        let options = reveal.getConfig().webcam || {};
        let FULLSCREEN_VIDEO_HORIZONTAL_PADDING = typeof options.fullscreen_horizontal_padding == 'number' ? options.fullscreen_horizontal_padding : 20;
        let FULLSCREEN_VIDEO_VERTICAL_PADDING = typeof options.fullscreen_vertical_padding == 'number' ? options.fullscreen_vertical_padding : 20;
        let FULLSCREEN_VIDEO_OPACITY = options.fullscreen_opacity || 1.0;
        let SHRINK_ON_OVERVIEW = options.shrink_on_overview !== false;
        let KEY_TOGGLE = options.keyToggle || 'c';
        let KEY_FULLSCREEN = options.keyFullscreen || 'C';

        let currentlyFullscreen = false;
        let currentlyHidden = false;

        let video = document.createElement('video');
        video.classList.add('webcam');
        video.classList.add('permanent');
        video.style.left = '20px';
        video.style.top = '20px';
        video.style.height = '100px';
        video.style.position = 'fixed';
        video.style.zIndex = '100';
        video.style.transition = '0.5s ease';
        video.style.opacity = '0.3';
        document.body.appendChild(video);


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
            let viewportWidth = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
            let viewportHeight = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);

            let videoHeight = videoElement.videoHeight;
            let videoWidth = videoElement.videoWidth;
            // If video size is completely specified by user take this as canonical video dimensions
            if (videoElement.style.width && videoElement.style.height) {
                videoHeight = parseInt(videoElement.style.height);
                videoWidth = parseInt(videoElement.style.width);
            }

            let hRatio = (videoHeight + 2 * FULLSCREEN_VIDEO_VERTICAL_PADDING) / viewportHeight;
            let wRatio = (videoWidth + 2 * FULLSCREEN_VIDEO_HORIZONTAL_PADDING) / viewportWidth;

            if (!currentlyHidden) {
                if (!videoElement.hasAttribute('data-webcam-old-opacity')) {
                    videoElement.setAttribute('data-webcam-old-opacity', videoElement.style.opacity);
                }
                videoElement.style.opacity = FULLSCREEN_VIDEO_OPACITY;
            }

            let newVideoWidth, newVideoHeight, horizontalPadding, verticalPadding;
            if (wRatio > hRatio) {
                newVideoWidth = Math.round(viewportWidth - 2 * FULLSCREEN_VIDEO_HORIZONTAL_PADDING);
                newVideoHeight = Math.round(newVideoWidth * videoHeight / videoWidth);
                horizontalPadding = FULLSCREEN_VIDEO_HORIZONTAL_PADDING;
                verticalPadding = Math.round(0.5 * (viewportHeight - newVideoHeight));
            } else {
                newVideoHeight = Math.round(viewportHeight - 2 * FULLSCREEN_VIDEO_VERTICAL_PADDING);
                newVideoWidth = Math.round(newVideoHeight * videoWidth / videoHeight);
                horizontalPadding = Math.round(0.5 * (viewportWidth - newVideoWidth));
                verticalPadding = FULLSCREEN_VIDEO_VERTICAL_PADDING;
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

        reveal.addEventListener('ready', function (event) {
            if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
                console.warn("Couldn't retrieve webcam video: feature unsupported by your browser");
                return;
            }
            navigator.mediaDevices.getUserMedia({video: true}).then(function (localMediaStream) {
                let webcamContainers = document.querySelectorAll('video.webcam');
                for (let i = 0; i < webcamContainers.length; ++i) {
                    webcamContainers[i].srcObject = localMediaStream;
                    webcamContainers[i].setAttribute('autoplay', true);
                    webcamContainers[i].setAttribute('data-autoplay', true);
                }

                //Create permanent webcam
                let permanentCam = document.querySelector('video.webcam.permanent');
                if (permanentCam) {
                    permanentCam.srcObject = localMediaStream;
                    permanentCam.setAttribute('autoplay', 'true');
                    if (SHRINK_ON_OVERVIEW) {
                        reveal.addEventListener('overviewshown', function (event) {
                            if (currentlyFullscreen && !currentlyHidden) {
                                shrinkWebcamVideo(permanentCam);
                                currentlyFullscreen = false;
                            }
                        });
                    }

                    window.addEventListener('keydown', function (event) {
                        if (document.querySelector(':focus') !== null || event.altKey || event.ctrlKey || event.metaKey)
                            return;

                        if (event.key === KEY_TOGGLE || event.key === KEY_FULLSCREEN) {
                            event.preventDefault();

                            if (event.key === KEY_FULLSCREEN) {
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

                                    permanentCam.style.opacity = 0;
                                    currentlyHidden = true;
                                } else {
                                    if (currentlyFullscreen)
                                        permanentCam.style.opacity = FULLSCREEN_VIDEO_OPACITY;
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