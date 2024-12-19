import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {
  DrawingUtils,
  FilesetResolver,
  PoseLandmarker,
} from '@mediapipe/tasks-vision';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  demosSection = document.getElementById('demos');
  imageContainers = document.getElementsByClassName('detectOnClick');
  poseLandmarker: PoseLandmarker | undefined = undefined;
  runningMode: 'IMAGE' | 'VIDEO' = 'IMAGE';
  enableWebcamButton: HTMLButtonElement | undefined = undefined;
  webcamRunning: Boolean = false;
  videoHeight = '360px';
  videoWidth = '480px';
  lastVideoTime = -1;

  ngOnInit(): void {
    this.createPoseLandmarker;
    this.addListener();
    this.handleClick;
    this.isWebcamSupported();
  }
  // Before we can use PoseLandmarker class we must wait for it to finish
  // loading. Machine Learning models can be large and take a moment to
  // get everything needed to run.
  createPoseLandmarker = async () => {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm'
    );
    this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task`,
        delegate: 'GPU',
      },
      runningMode: this.runningMode,
      numPoses: 2,
    });
    this.demosSection!.classList.remove('invisible');
  };

  /********************************************************************
// Demo 1: Grab a bunch of images from the page and detection them
// upon click.
********************************************************************/

  // In this demo, we have put all our clickable images in divs with the
  // CSS class 'detectionOnClick'. Lets get all the elements that have
  // this class.

  // Now let's go through all of these and add a click event listener.
  addListener() {
    for (let i = 0; i < this.imageContainers.length; i++) {
      // Add event listener to the child element whichis the img element.
      this.imageContainers[i].children[0].addEventListener(
        'click',
        this.handleClick
      );
    }
  }

  // When an image is clicked, let's detect it and display results!
  handleClick = async (event: any) => {
    if (!this.poseLandmarker) {
      console.log('Wait for poseLandmarker to load before clicking!');
      return;
    }

    if (this.runningMode === 'VIDEO') {
      this.runningMode = 'IMAGE';
      await this.poseLandmarker.setOptions({ runningMode: 'IMAGE' });
    }
    // Remove all landmarks drawed before
    const allCanvas = event.target.parentNode.getElementsByClassName('canvas');
    for (var i = allCanvas.length - 1; i >= 0; i--) {
      const n = allCanvas[i];
      n.parentNode.removeChild(n);
    }

    // We can call poseLandmarker.detect as many times as we like with
    // different image data each time. The result is returned in a callback.
    this.poseLandmarker.detect(event.target, (result) => {
      const canvas = document.createElement('canvas');
      canvas.setAttribute('class', 'canvas');
      canvas.setAttribute('width', event.target.naturalWidth + 'px');
      canvas.setAttribute('height', event.target.naturalHeight + 'px');
      canvas.setAttribute('left', '0');
      canvas.setAttribute('top', '0');

      event.target.parentNode.appendChild(canvas);
      const canvasCtx = canvas.getContext('2d')!;
      const drawingUtils = new DrawingUtils(canvasCtx);
      for (const landmark of result.landmarks) {
        drawingUtils.drawLandmarks(landmark, {
          radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
        });
        drawingUtils.drawConnectors(landmark, PoseLandmarker.POSE_CONNECTIONS);
      }
    });
  };

  /********************************************************************
// Demo 2: Continuously grab image from webcam stream and detect it.
********************************************************************/

  video = document.getElementById('webcam') as HTMLVideoElement;
  canvasElement = document.getElementById('output_canvas') as HTMLCanvasElement;
  canvasCtx = this.canvasElement.getContext('2d')!;
  drawingUtils = new DrawingUtils(this.canvasCtx);

  // Check if webcam access is supported.
  hasGetUserMedia = () => !!navigator.mediaDevices?.getUserMedia;

  // If webcam supported, add event listener to button for when user
  // wants to activate it.
  isWebcamSupported() {
    if (this.hasGetUserMedia()) {
      const enableWebcamButton = document.getElementById('webcamButton')!;
      enableWebcamButton.addEventListener('click', this.enableCam);
    } else {
      console.warn('getUserMedia() is not supported by your browser');
    }
  }

  // Enable the live webcam view and start detection.
  enableCam(event: any) {
    if (!this.poseLandmarker) {
      console.log('Wait! poseLandmaker not loaded yet.');
      return;
    }
    if (this.enableWebcamButton)
      if (this.webcamRunning === true) {
        this.webcamRunning = false;
        this.enableWebcamButton.innerText = 'ENABLE PREDICTIONS';
      } else {
        this.webcamRunning = true;
        this.enableWebcamButton.innerText = 'DISABLE PREDICTIONS';
      }

    // getUsermedia parameters.
    const constraints = {
      video: true,
    };

    // Activate the webcam stream.
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
      this.video.srcObject = stream;
      this.video.addEventListener('loadeddata', this.predictWebcam);
    });
  }

  predictWebcam = async () => {
    this.canvasElement.style.height = this.videoHeight;
    this.video.style.height = this.videoHeight;
    this.canvasElement.style.width = this.videoWidth;
    this.video.style.width = this.videoWidth;
    // Now let's start detecting the stream.
    if (this.runningMode === 'IMAGE') {
      this.runningMode = 'VIDEO';
      await this.poseLandmarker!.setOptions({ runningMode: 'VIDEO' });
    }
    let startTimeMs = performance.now();
    if (this.lastVideoTime !== this.video.currentTime) {
      this.lastVideoTime = this.video.currentTime;
      this.poseLandmarker!.detectForVideo(this.video, startTimeMs, (result) => {
        this.canvasCtx.save();
        this.canvasCtx.clearRect(
          0,
          0,
          this.canvasElement.width,
          this.canvasElement.height
        );
        for (const landmark of result.landmarks) {
          this.drawingUtils.drawLandmarks(landmark, {
            radius: (data) => DrawingUtils.lerp(data.from!.z, -0.15, 0.1, 5, 1),
          });
          this.drawingUtils.drawConnectors(
            landmark,
            PoseLandmarker.POSE_CONNECTIONS
          );
        }
        this.canvasCtx.restore();
      });
    }

    // Call this function again to keep predicting when the browser is ready.
    if (this.webcamRunning === true) {
      window.requestAnimationFrame(this.predictWebcam);
    }
  };
}
