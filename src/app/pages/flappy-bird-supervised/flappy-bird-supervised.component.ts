import { Component, ViewChild, ElementRef, OnInit } from '@angular/core';

import { CommonModule } from '@angular/common';
import * as tf from '@tensorflow/tfjs';
import p5 from 'p5';
import Background from './background';
import Obstacle from './obstacle';
import Bird from './bird';
import { TensorflowVisSampleComponent } from '../../common/tensorflow-visualization/tensorflow-visualization.component';
import { ITensorflowSettings } from '../../common/itensorflow-settings';
/** Enum for possible actions */
enum Action {
  Nothing = 0,
  Jump = 1
}

/** Interface for data structure */
interface Data {
  yTarget: number,
  yAgent: number,
  action: Action
}

/** Component metadata */
@Component({
  selector: 'app-flappy-bird-supervised',
  standalone: true,
  imports: [CommonModule, TensorflowVisSampleComponent],
  templateUrl: './flappy-bird-supervised.component.html',
  styleUrls: ['./flappy-bird-supervised.component.scss']
})
export class FlappyBirdSupervisedComponent extends ITensorflowSettings implements OnInit {


  /** Screen height */
  readonly screenYSize: number = window.innerHeight;

  /** Array to hold training data */
  data: Data[] = [];

  /** Accessing the canvas element */
  @ViewChild('canvas', { static: true }) canvas!: ElementRef<HTMLCanvasElement>;

  nextYellowPointX: number = 0; // Variável para armazenar a coordenada X do ponto amarelo em relação à ave
  birdX: number = 0; // Variável para armazenar a coordenada X da ave


  scorePipes = 0

  p!: p5;


  /**
    * Instance of upPipe
    */
  upPipe!: p5.Image;

  /**
    * Instance of downPipe
    */
  downPipe!: p5.Image;

  /**
   * Intance of Background
   */
  background!: Background;

  /**
   * List of with instance of Obstacles
   */
  obstacles: Obstacle[] = [];

  bird!: Bird;
  constructor() {
    super()


  }
  override createData(): void {
    debugger
    const json = this.creatingDataToTraining();
  }


  ngOnInit(): void {
    this.canvas
    this.model$.subscribe((m) => {

      if (m) {
        this.p = new p5(this.sketch.bind(this))
      }

    })
  }


  override setScenario(): void { }

  sketch(p: p5) {
    p.setup = () => this.setup(p);
    p.draw = () => this.draw(p);
  }

  setup(p: p5) {
    const bg = p.loadImage('assets/bg.png');
    const ground = p.loadImage('assets/ground.png');
    this.upPipe = p.loadImage('assets/pipeUp.png');
    this.downPipe = p.loadImage('assets/pipeDown.png');
    const birdImage = p.loadImage('assets/bird.png');

    this.background = new Background(p, bg, ground, this.width, this.height);

    this.initObstacles(p, this.upPipe, this.downPipe)

    p.createCanvas(this.width, this.height, this.canvas.nativeElement);
    this.bird = new Bird(p, birdImage, ground, this.height)
  }


  draw(p: p5) {
    p.background(111, 197, 206);
    this.background.drawBackground();
    this.obstacles.forEach(obs => {
      obs.draw();
      if (obs.isOffscreen(this.obstacles)) {
        this.scorePipes += 1
      }
    });

    this.bird.update(this.obstacles);

    const { agentY, targetY } = this.bird.info(this.obstacles);

    const inputs = tf.tensor([[agentY, targetY]]); // Cria um tensor com as entradas

    const prediction = this.model?.predict(inputs) as tf.Tensor;

    // Use tf.argMax para obter o índice da classe prevista
    const classIdTensor = tf.argMax(prediction, 1);
    const classIdArray = classIdTensor.arraySync() as any;
    const classId = classIdArray[0]; // Como temos apenas uma amostra, pegamos o primeiro valor

    const classes = ["Nothing", "JUMP"];
    const classPredicted = classes[classId];
    if (classPredicted === "JUMP") {
      this.bird.jump()
    }


    p.textSize(20)
    p.text(`Score (Pipe counter): ${this.scorePipes}`, 10, 110)
    this.background.drawGround();

  }

  /**
   * Create and recreate the pipes(obstacles)
   * @param p5 instance
   * @param upPipe instance
   * @param downPipe instance
   */
  initObstacles(p: p5, upPipe: p5.Image, downPipe: p5.Image) {
    this.obstacles = [];
    const space = 400
    for (let index = 0; index < 10; index++) {
      this.obstacles.push(new Obstacle(p, upPipe, downPipe, this.width, this.height, this.width + (space * index)));
    }
  }

  settingTensorflow() {
    debugger
    /** Map data to inputs */
    this.inputs = this.data.map(d => [d.yAgent, d.yTarget]);

    /** Map data to labels */
    this.labels = this.data.map(d => Number(d.action));

    /** TensorFlow settings */
    this.settings = {
      compiler: {
        optimizer: tf.train.adam(),
        loss: 'sparseCategoricalCrossentropy', // Use sparseCategoricalCrossentropy for multi-class classification
        metrics: ['accuracy']
      },


      fit: { batchSize: 512, epochs: 5 },
      inputs: this.inputs,
      labels: this.labels,
      mainLayers: [tf.layers.dense({ units: 32, activation: 'relu', inputShape: [2] })],
      finalLayer: tf.layers.dense({ units: 2, activation: 'softmax' }),
    };
  }

  /** Function to create training data */
  creatingDataToTraining() {
    this.data = []
    for (let target = 0; target < window.innerHeight; target += 5) {
      for (let agent = 0; agent < window.innerHeight; agent += 5) {
        if (agent < target) {
          this.data.push({ yAgent: agent, yTarget: target, action: Action.Nothing });
        } else {
          this.data.push({ yAgent: agent, yTarget: target, action: Action.Jump });
        }
      }
    }
    return JSON.stringify(this.data);
  }

  /** Callback when the model is trained */
  modelTrainned(model: tf.Sequential) {
    this.model = model;
  }
}
