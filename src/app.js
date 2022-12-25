import * as THREE from 'three';
import {VRButton} from "three/addons/webxr/VRButton";
import {BoxLineGeometry} from "three/addons/geometries/BoxLineGeometry";
import House from "../assets/Houseinball.glb"
import {GLTFLoader} from "three/examples/jsm/loaders/GLTFLoader";
import {XRControllerModelFactory} from "three/examples/jsm/webxr/XRControllerModelFactory";


class App {
    constructor() {
        const container = document.createElement('div');
        document.body.appendChild(container);

        this.controllers = []

        this.clock = new THREE.Clock();

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 1.6, 0);

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x505050);

        this.scene.add(new THREE.HemisphereLight(0x606060, 0x404040));

        const light = new THREE.DirectionalLight(0xffffff);
        light.position.set(1, 1, 1).normalize();
        this.scene.add(light);

        this.renderer = new THREE.WebGLRenderer({antialias: true});
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.shadowMap.enabled = true;
        this.renderer.xr.enabled = true;

        container.appendChild(this.renderer.domElement);

        this.vec3 = new THREE.Vector3();

        this.initScene();
        this.setupXR();

        this.getInputSources = true;

        window.addEventListener('resize', this.resize.bind(this));

        this.renderer.setAnimationLoop(this.render.bind(this));
    }

    loadAsset(glbObject, x, y, z, sceneHandler) {
        const self = this
        const loader = new GLTFLoader()
        loader.load(glbObject, (gltf) => {
                const gltfScene = gltf.scene
                self.scene.add(gltfScene)
                gltfScene.position.set(x, y, z)
                if (sceneHandler) {
                    sceneHandler(gltfScene)
                }
            },
            null,
            (error) => console.error(`An error happened: ${error}`))
    }


    initScene() {
        this.room = new THREE.LineSegments(
            new BoxLineGeometry(6, 6, 6, 10, 10, 10),
            new THREE.LineBasicMaterial({color: 0x808080})
        );

        const geo1 = new THREE.SphereBufferGeometry(0.1, 16, 8);
        const mat1 = new THREE.MeshStandardMaterial({color: 0x3333ff});
        const mat2 = new THREE.MeshStandardMaterial({color: 0x33ff33});
        this.materials = [mat1, mat2];
        this.rsphere = new THREE.Mesh(geo1, mat1);
        this.rsphere.position.set(0.5, 1.6, -1);
        this.scene.add(this.rsphere);
        this.lsphere = new THREE.Mesh(geo1, mat1);
        this.lsphere.position.set(-0.5, 1.6, -1);
        this.scene.add(this.lsphere);

        this.room.geometry.translate(0, 3, 0);
        this.scene.add(this.room);
    }

    setupXR() {
        this.renderer.xr.enabled = true;

        document.body.appendChild(VRButton.createButton(this.renderer));
    }

    resize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        const dt = this.clock.getDelta()
        if (this.renderer.xr.isPresenting) {
            const session = this.renderer.xr.getSession();
            const inputSources = session.inputSources;

            this.counter += this.clock.getDelta()
            if (this.counter > .2) {
                this.getInputSources = true
                this.counter = 0
            }
            if (this.getInputSources) {
                const info = [];

                inputSources.forEach(inputSource => {
                    const gp = inputSource.gamepad;
                    const axes = gp.axes;
                    const buttons = gp.buttons;
                    const mapping = gp.mapping;
                    this.useStandard = (mapping === 'xr-standard');
                    const gamepad = {axes, buttons, mapping};
                    const handedness = inputSource.handedness;
                    const profiles = inputSource.profiles;
                    this.type = "";
                    profiles.forEach(profile => {
                        if (profile.indexOf('touchpad') !== -1) this.type = 'touchpad';
                        if (profile.indexOf('thumbstick') !== -1) this.type = 'thumbstick';
                    });
                    const targetRayMode = inputSource.targetRayMode;
                    info.push({gamepad, handedness, profiles, targetRayMode});
                });

                console.log(JSON.stringify(info));

                this.getInputSources = false;
            } else if (this.useStandard && this.type !== "") {
                inputSources.forEach(inputSource => {
                    const gp = inputSource.gamepad;
                    const thumbstick = (this.type === 'thumbstick');
                    const offset = (thumbstick) ? 2 : 0;
                    const btnIndex = (thumbstick) ? 3 : 2;
                    const btnPressed = gp.buttons[btnIndex].pressed;
                    const material = (btnPressed) ? this.materials[1] : this.materials[0];
                    const deltaX = gp.axes[offset]
                    const deltaY = gp.axes[offset + 1]
                    if (inputSource.handedness === 'right') {
                        this.rsphere.position.set(0.5, 1.6, -1).add(this.vec3.set(gp.axes[offset], -gp.axes[offset + 1], 0));
                        this.rsphere.material = material;
                        this.rightStick(deltaX, deltaY, btnPressed)
                    } else if (inputSource.handedness === 'left') {
                        this.lsphere.position.set(-0.5, 1.6, -1).add(this.vec3.set(gp.axes[offset], -gp.axes[offset + 1], 0));
                        this.lsphere.material = material;
                        this.leftStick(deltaX, deltaY, btnPressed)
                    }
                })
            }
        }
        this.renderer.render(this.scene, this.camera);
        this.controllerAction(dt)
    }

    rightStick(deltaX, deltaY, buttonPressed) {
        if (this.snowman && buttonPressed) {
            // Zoom model
            const currentScale = this.snowman.scale.x
            let scale
            if (currentScale >= 1) {
                scale = currentScale - .1 * deltaY
            } else {
                scale = 1 / (1 / currentScale + .1 * deltaY)
            }
            this.snowman.scale.set(scale, scale, scale)
        } else if(this.snowman) {
            // Rotate model
            this.snowman.rotateY(Math.PI / 180 * 10 * deltaX)
            this.snowman.rotateZ(Math.PI / 180 * 10 * deltaY)
        }
    }

    leftStick(deltaX, deltaY, buttonPressed) {
        if (this.snowman && buttonPressed) {

        } else if(this.snowman) {
            this.snowman.position.add(this.vec3.set(.05 * deltaX, 0, .05 * deltaY))
        }
    }
}

export {App};
