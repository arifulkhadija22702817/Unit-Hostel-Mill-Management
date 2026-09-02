import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export type ATMAnimationStatus = 'idle' | 'aligning' | 'inserting' | 'verifying' | 'ejecting' | 'granted' | 'denied';

interface ThreeATMSceneProps {
  status: ATMAnimationStatus;
  selectedRole: 'editor' | 'admin';
  emailInput: string;
  pinInput: string;
  scanProgress: number;
  statusMessage: string;
  isMobile: boolean;
}

export const ThreeATMScene: React.FC<ThreeATMSceneProps> = ({
  status,
  selectedRole,
  emailInput,
  pinInput,
  scanProgress,
  statusMessage,
  isMobile,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const cardGroupRef = useRef<THREE.Group | null>(null);
  const slotLightRef = useRef<THREE.PointLight | null>(null);
  const laserStripRef = useRef<THREE.Mesh | null>(null);
  const screenTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const cardTextureRef = useRef<THREE.CanvasTexture | null>(null);
  const screenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cardCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Status & isMobile refs to avoid stale closures in Three.js animate loop
  const statusRef = useRef<ATMAnimationStatus>(status);
  const isMobileRef = useRef<boolean>(isMobile);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    isMobileRef.current = isMobile;
  }, [isMobile]);

  // Target animation state
  const animState = useRef({
    // Current interpolated
    curX: 1.6,
    curY: -0.1,
    curZ: 1.1,
    curRotX: -0.15,
    curRotY: -0.32,
    curRotZ: 0.05,
    curScale: 1.0,

    // Targets
    targetX: 1.6,
    targetY: -0.1,
    targetZ: 1.1,
    targetRotX: -0.15,
    targetRotY: -0.32,
    targetRotZ: 0.05,
    targetScale: 1.0,

    // Mouse interactive target
    mouseRotX: 0,
    mouseRotY: 0,
  });

  // 1. Draw dynamic Card Face Texture Canvas
  const updateCardTexture = () => {
    let canvas = cardCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 648;
      cardCanvasRef.current = canvas;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background Metallic Gradient
    const grad = ctx.createLinearGradient(0, 0, 1024, 648);
    if (selectedRole === 'editor') {
      grad.addColorStop(0, '#064e3b');
      grad.addColorStop(0.5, '#042f2e');
      grad.addColorStop(1, '#021815');
    } else {
      grad.addColorStop(0, '#4c1d95');
      grad.addColorStop(0.5, '#1e1b4b');
      grad.addColorStop(1, '#09071b');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1024, 648);

    // Decorative circuit patterns
    ctx.strokeStyle = selectedRole === 'editor' ? 'rgba(52, 211, 153, 0.35)' : 'rgba(192, 132, 252, 0.35)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(40, 190);
    ctx.lineTo(280, 190);
    ctx.lineTo(380, 290);
    ctx.lineTo(980, 290);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(40, 480);
    ctx.lineTo(420, 480);
    ctx.lineTo(520, 390);
    ctx.lineTo(980, 390);
    ctx.stroke();

    // Hologram Sheen Overlays
    const holo = ctx.createLinearGradient(0, 0, 1024, 648);
    holo.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
    holo.addColorStop(0.3, 'rgba(255, 255, 255, 0)');
    holo.addColorStop(0.5, 'rgba(255, 255, 255, 0.28)');
    holo.addColorStop(0.7, 'rgba(255, 255, 255, 0)');
    holo.addColorStop(1, 'rgba(255, 255, 255, 0.18)');
    ctx.fillStyle = holo;
    ctx.fillRect(0, 0, 1024, 648);

    // Gold EMV Chip Graphic
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(80, 150, 160, 120, 16);
    ctx.fill();
    ctx.stroke();

    // Chip internal circuit lines
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(80, 210);
    ctx.lineTo(240, 210);
    ctx.moveTo(160, 150);
    ctx.lineTo(160, 270);
    ctx.stroke();

    // Contactless Wi-Fi Waves
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(300, 210, 25, -Math.PI / 3, Math.PI / 3, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(300, 210, 45, -Math.PI / 3, Math.PI / 3, false);
    ctx.stroke();

    // Top Header: Bank Name & Role Badge
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Segoe UI", sans-serif';
    ctx.fillText('BANGLADESH MESS ATM', 80, 80);

    ctx.fillStyle = selectedRole === 'editor' ? '#34d399' : '#c084fc';
    ctx.font = 'black 30px "Segoe UI", monospace';
    const roleText = selectedRole === 'editor' ? '💳 3-EDITOR PASS' : '👑 ADMIN MASTER';
    ctx.fillText(roleText, 600, 80);

    // PIN Display Panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.beginPath();
    ctx.roundRect(80, 310, 864, 110, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 22px "Segoe UI", sans-serif';
    ctx.fillText('SECURITY PIN / PASSWORD', 110, 345);

    ctx.fillStyle = '#fde047';
    ctx.font = 'bold 44px monospace';
    if (pinInput) {
      const dots = pinInput.split('').map(() => '●').join('  ');
      ctx.fillText(dots, 110, 395);
    } else {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.font = 'italic 28px "Segoe UI", sans-serif';
      ctx.fillText('গোপন পিন কোড ইনপুট দিন...', 110, 390);
    }

    // Bottom Row: Card Holder Email
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 22px "Segoe UI", sans-serif';
    ctx.fillText('CARD HOLDER (GMAIL)', 80, 500);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px monospace';
    const holderText = emailInput ? emailInput : (selectedRole === 'editor' ? 'আপনার Gmail লিখুন...' : 'এডমিন Gmail লিখুন...');
    ctx.fillText(holderText, 80, 545);

    // Card Status Tag
    if (status === 'granted') {
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 26px monospace';
      ctx.fillText('STATUS: GRANTED ✔', 720, 545);
    } else if (status === 'denied') {
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 26px monospace';
      ctx.fillText('STATUS: EJECTED ✖', 720, 545);
    } else if (status === 'verifying' || status === 'inserting') {
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 26px monospace';
      ctx.fillText('STATUS: INSIDE ATM...', 700, 545);
    } else {
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 26px monospace';
      ctx.fillText('STATUS: READY', 780, 545);
    }

    if (cardTextureRef.current) {
      cardTextureRef.current.needsUpdate = true;
    }
  };

  // 2. Draw dynamic ATM LCD Screen Texture Canvas
  const updateScreenTexture = () => {
    let canvas = screenCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 512;
      screenCanvasRef.current = canvas;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background color based on status
    if (status === 'granted') {
      ctx.fillStyle = '#064e3b';
    } else if (status === 'denied') {
      ctx.fillStyle = '#4c0519';
    } else if (status === 'verifying' || status === 'inserting' || status === 'aligning') {
      ctx.fillStyle = '#083344';
    } else {
      ctx.fillStyle = '#020617';
    }
    ctx.fillRect(0, 0, 1024, 512);

    // CRT Scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    for (let i = 0; i < 512; i += 8) {
      ctx.fillRect(0, i, 1024, 4);
    }

    // Bezel Border
    ctx.strokeStyle = status === 'granted' ? '#10b981' : status === 'denied' ? '#f43f5e' : '#06b6d4';
    ctx.lineWidth = 12;
    ctx.strokeRect(10, 10, 1004, 492);

    // Screen Header
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 28px monospace';
    ctx.fillText('TERMINAL: BANGLADESH ATM V4.2', 40, 60);

    ctx.fillStyle = status === 'granted' ? '#34d399' : status === 'denied' ? '#fb7185' : '#38bdf8';
    ctx.fillText(`STATUS: ${status.toUpperCase()}`, 720, 60);

    // Dividing line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(40, 85);
    ctx.lineTo(984, 85);
    ctx.stroke();

    // Main Message
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "Segoe UI", sans-serif';
    ctx.fillText(statusMessage, 40, 170);

    // Progress bar for inserting / verifying
    if (status === 'verifying') {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(40, 240, 944, 40);
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 4;
      ctx.strokeRect(40, 240, 944, 40);

      ctx.fillStyle = '#22d3ee';
      const fillW = Math.max(20, (944 * scanProgress) / 100);
      ctx.fillRect(44, 244, fillW - 8, 32);

      ctx.fillStyle = '#e0f2fe';
      ctx.font = 'bold 28px monospace';
      ctx.fillText(`মেশিনের ভেতরে চিপ ডেটা যাচাই চলছে: ${scanProgress}%`, 40, 330);
    } else if (status === 'aligning' || status === 'inserting') {
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 32px "Segoe UI", sans-serif';
      ctx.fillText('⚡ কার্ড মেশিনের স্লটের ভেতরে প্রবেশ করছে...', 40, 260);
    } else if (status === 'granted') {
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 40px "Segoe UI", sans-serif';
      ctx.fillText('✔ যাচাই সফল! কার্ড বের হয়েছে — সিস্টেমে প্রবেশ করা হচ্ছে...', 40, 270);
    } else if (status === 'denied') {
      ctx.fillStyle = '#fb7185';
      ctx.font = 'bold 36px "Segoe UI", sans-serif';
      ctx.fillText('✖ তথ্য মেলেনি! কার্ড মেশিন থেকে বের হয়ে এসেছে।', 40, 270);
    } else {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '28px "Segoe UI", sans-serif';
      ctx.fillText('💳 নিচে লগইন বাটনে চাপলে কার্ড সরাসরি মেশিনের ভেতর ঢুকবে', 40, 270);
    }

    // Screen footer
    ctx.fillStyle = '#64748b';
    ctx.font = '24px monospace';
    ctx.fillText('256-BIT QUANTUM ENCRYPTION • SECURE BANK CORE', 40, 460);

    if (screenTextureRef.current) {
      screenTextureRef.current.needsUpdate = true;
    }
  };

  useEffect(() => {
    updateCardTexture();
  }, [selectedRole, emailInput, pinInput, status]);

  useEffect(() => {
    updateScreenTexture();
  }, [status, statusMessage, scanProgress]);

  // Main Three.js Lifecycle
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Camera
    const width = container.clientWidth || 850;
    const height = container.clientHeight || 420;
    const camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    cameraRef.current = camera;

    // Camera framing: PC shows ATM on left and Card on right side-by-side in 3D
    if (isMobile) {
      camera.position.set(0.1, 0.1, 7.2);
      camera.lookAt(0, 0, 0);
    } else {
      camera.position.set(0.2, 0.1, 5.8);
      camera.lookAt(0, 0, 0);
    }

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;
    renderer.localClippingEnabled = true; // Enables clipping plane so card physically enters slot!
    rendererRef.current = renderer;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // Lighting setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambientLight);

    const mainLight = new THREE.DirectionalLight(0xffffff, 2.8);
    mainLight.position.set(3, 5, 5);
    mainLight.castShadow = true;
    scene.add(mainLight);

    const cyanRimLight = new THREE.DirectionalLight(0x06b6d4, 2.2);
    cyanRimLight.position.set(-5, 2, 2);
    scene.add(cyanRimLight);

    const purpleFill = new THREE.PointLight(0xa855f7, 1.6, 12);
    purpleFill.position.set(4, -2, 3);
    scene.add(purpleFill);

    // ----------------------------------------------------
    // 1. LEFT SIDE: 3D ATM MACHINE TERMINAL MESH
    // Positioned at X = -1.35 in 3D space
    // ----------------------------------------------------
    const atmGroup = new THREE.Group();
    atmGroup.position.set(-1.3, 0.0, 0);
    atmGroup.rotation.set(0, 0.15, 0); // Angled slightly towards camera
    scene.add(atmGroup);

    // ATM Main Cabinet (Dark metallic steel)
    const cabinetGeo = new THREE.BoxGeometry(2.6, 3.4, 1.4);
    const cabinetMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.88,
      roughness: 0.22,
    });
    const cabinetMesh = new THREE.Mesh(cabinetGeo, cabinetMat);
    cabinetMesh.castShadow = true;
    cabinetMesh.receiveShadow = true;
    atmGroup.add(cabinetMesh);

    // ATM Chamfered Bezel
    const bezelGeo = new THREE.BoxGeometry(2.45, 3.25, 0.15);
    const bezelMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.9,
      roughness: 0.2,
    });
    const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
    bezelMesh.position.set(0, 0, 0.72);
    atmGroup.add(bezelMesh);

    // ATM Upper LCD Screen
    const screenGeo = new THREE.PlaneGeometry(2.2, 1.1);
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 1024;
    screenCanvas.height = 512;
    screenCanvasRef.current = screenCanvas;
    const screenTexture = new THREE.CanvasTexture(screenCanvas);
    screenTextureRef.current = screenTexture;

    const screenMat = new THREE.MeshBasicMaterial({
      map: screenTexture,
    });
    const screenMesh = new THREE.Mesh(screenGeo, screenMat);
    screenMesh.position.set(0, 0.8, 0.81);
    atmGroup.add(screenMesh);
    updateScreenTexture();

    // ----------------------------------------------------
    // PHYSICAL HOLLOW CARD SLOT MECHANISM ON ATM
    // Slot is at local atm coordinates: X = 0.35, Y = -0.15, Z = 0.8
    // In world coordinates approx: X = -0.92, Y = -0.15, Z = 0.84
    // ----------------------------------------------------
    const slotGroup = new THREE.Group();
    slotGroup.position.set(0.35, -0.15, 0.8);
    atmGroup.add(slotGroup);

    // Top Lip of Slot Bezel
    const lipTopGeo = new THREE.BoxGeometry(1.6, 0.1, 0.25);
    const lipMat = new THREE.MeshStandardMaterial({
      color: 0x020617,
      metalness: 0.95,
      roughness: 0.15,
    });
    const lipTop = new THREE.Mesh(lipTopGeo, lipMat);
    lipTop.position.set(0, 0.08, 0.05);
    slotGroup.add(lipTop);

    // Bottom Lip of Slot Bezel
    const lipBottomGeo = new THREE.BoxGeometry(1.6, 0.1, 0.25);
    const lipBottom = new THREE.Mesh(lipBottomGeo, lipMat);
    lipBottom.position.set(0, -0.08, 0.05);
    slotGroup.add(lipBottom);

    // Left & Right Slot Walls
    const lipSideGeo = new THREE.BoxGeometry(0.12, 0.26, 0.25);
    const lipLeft = new THREE.Mesh(lipSideGeo, lipMat);
    lipLeft.position.set(-0.74, 0, 0.05);
    slotGroup.add(lipLeft);

    const lipRight = new THREE.Mesh(lipSideGeo, lipMat);
    lipRight.position.set(0.74, 0, 0.05);
    slotGroup.add(lipRight);

    // Deep Dark Slot Throat (Black void where card vanishes inside)
    const slotThroatGeo = new THREE.PlaneGeometry(1.36, 0.09);
    const slotThroatMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const slotThroat = new THREE.Mesh(slotThroatGeo, slotThroatMat);
    slotThroat.position.set(0, 0, 0.01);
    slotGroup.add(slotThroat);

    // Glowing Green / Cyan / Red Laser Guide Strip
    const laserGeo = new THREE.PlaneGeometry(1.35, 0.03);
    const laserMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.95,
    });
    const laserMesh = new THREE.Mesh(laserGeo, laserMat);
    laserMesh.position.set(0, 0.14, 0.08);
    slotGroup.add(laserMesh);
    laserStripRef.current = laserMesh;

    // Slot Aperture Point Light
    const slotLight = new THREE.PointLight(0x34d399, 3.5, 5);
    slotLight.position.set(0, 0.15, 0.3);
    slotGroup.add(slotLight);
    slotLightRef.current = slotLight;

    // ATM Angled Keypad Shelf
    const keypadTrayGeo = new THREE.BoxGeometry(2.2, 0.75, 0.2);
    const keypadTrayMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      metalness: 0.92,
      roughness: 0.25,
    });
    const keypadTrayMesh = new THREE.Mesh(keypadTrayGeo, keypadTrayMat);
    keypadTrayMesh.position.set(0, -0.88, 0.82);
    keypadTrayMesh.rotation.x = 0.42;
    atmGroup.add(keypadTrayMesh);

    // Keypad Buttons Grid (3x4 metallic keys)
    const keyGeo = new THREE.BoxGeometry(0.22, 0.11, 0.06);
    const keyMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.9,
      roughness: 0.2,
    });
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 3; col++) {
        const keyMesh = new THREE.Mesh(keyGeo, keyMat);
        keyMesh.position.set((col - 1) * 0.34, 0.22 - row * 0.15, 0.11);
        keypadTrayMesh.add(keyMesh);
      }
    }

    // ----------------------------------------------------
    // 2. RIGHT SIDE: 3D DYNAMIC SMART ATM CARD MESH
    // Initial position at X = 1.6, Y = -0.1, Z = 1.1
    // ----------------------------------------------------
    const cardGroup = new THREE.Group();
    cardGroupRef.current = cardGroup;
    scene.add(cardGroup);

    // Card dimensions: (width: 1.32, height: 0.84, depth: 0.02)
    // Sized perfectly so it fits seamlessly into the 1.36 wide slot throat!
    const cardGeo = new THREE.BoxGeometry(1.32, 0.84, 0.02);

    const cardCanvas = document.createElement('canvas');
    cardCanvas.width = 1024;
    cardCanvas.height = 648;
    cardCanvasRef.current = cardCanvas;
    const cardTexture = new THREE.CanvasTexture(cardCanvas);
    cardTextureRef.current = cardTexture;

    // CLIPPING PLANE: Positioned right behind the ATM Slot throat
    // As card pushes into the slot along -Z, any portion of the card
    // going past the slot throat is clipped, making it look 100% swallowed inside!
    const slotClipPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.7);

    const cardFrontMat = new THREE.MeshStandardMaterial({
      map: cardTexture,
      metalness: 0.65,
      roughness: 0.22,
      clippingPlanes: [slotClipPlane],
      clipShadows: true,
    });
    const cardEdgeMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.85,
      roughness: 0.2,
      clippingPlanes: [slotClipPlane],
      clipShadows: true,
    });
    const cardBackMat = new THREE.MeshStandardMaterial({
      color: 0x020617,
      metalness: 0.75,
      roughness: 0.25,
      clippingPlanes: [slotClipPlane],
      clipShadows: true,
    });

    const cardMaterials = [
      cardEdgeMat, // right
      cardEdgeMat, // left
      cardEdgeMat, // top
      cardEdgeMat, // bottom
      cardFrontMat, // front
      cardBackMat, // back
    ];

    const cardMesh = new THREE.Mesh(cardGeo, cardMaterials);
    cardMesh.castShadow = true;
    cardMesh.receiveShadow = true;
    cardGroup.add(cardMesh);
    updateCardTexture();

    // 3D Metallic EMV Microchip on Card
    const chipGeo = new THREE.BoxGeometry(0.24, 0.18, 0.012);
    const chipMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.95,
      roughness: 0.15,
      clippingPlanes: [slotClipPlane],
    });
    const chipMesh = new THREE.Mesh(chipGeo, chipMat);
    chipMesh.position.set(-0.42, 0.12, 0.015);
    cardGroup.add(chipMesh);

    // Initial positioning on the right side
    cardGroup.position.set(1.6, -0.1, 1.1);
    cardGroup.rotation.set(-0.15, -0.32, 0.05);

    // Window resize handler
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener('resize', handleResize);

    // Mouse interactive tilt handler for card in idle state
    const handlePointerMove = (e: MouseEvent) => {
      if (statusRef.current !== 'idle') return;
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      animState.current.mouseRotX = ny * 0.2;
      animState.current.mouseRotY = nx * 0.25;
    };

    container.addEventListener('mousemove', handlePointerMove);

    // Animation Render Loop
    let reqId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const time = clock.getElapsedTime();
      const state = animState.current;
      const curStatus = statusRef.current;
      const curMobile = isMobileRef.current;

      // Real World coordinates of the ATM slot entrance mouth:
      // atm is at (-1.3, 0, 0) rotated by y=0.15.
      // slotGroup is at local (0.35, -0.15, 0.8).
      // World coordinates of the slot mouth:
      const slotEntranceX = -0.92;
      const slotEntranceY = -0.15;
      const slotEntranceZ = 0.88;
      const slotFaceAngleY = 0.15;

      if (curStatus === 'idle') {
        // Floating cleanly on the right side beside the ATM machine
        state.targetX = curMobile ? 1.05 : 1.65;
        state.targetY = -0.1 + Math.sin(time * 2.5) * 0.04;
        state.targetZ = 1.1;
        state.targetRotX = -0.15 + state.mouseRotX;
        state.targetRotY = -0.32 + state.mouseRotY;
        state.targetRotZ = 0.05;
        state.targetScale = curMobile ? 0.9 : 1.0;
        if (cardGroupRef.current) cardGroupRef.current.visible = true;
      } else if (curStatus === 'aligning') {
        // STEP 1: Card lifts up, glides towards slot mouth and aligns horizontally
        state.targetX = slotEntranceX;
        state.targetY = slotEntranceY;
        state.targetZ = slotEntranceZ + 0.65; // right in front of the slot mouth
        state.targetRotX = 1.57; // horizontal card angle matching horizontal slot
        state.targetRotY = slotFaceAngleY; // aligned with ATM facade angle
        state.targetRotZ = 0;
        state.targetScale = 0.95;
        if (cardGroupRef.current) cardGroupRef.current.visible = true;
      } else if (curStatus === 'inserting') {
        // STEP 2: Card physically moves straight INTO the slot mouth and disappears inside
        state.targetX = slotEntranceX;
        state.targetY = slotEntranceY;
        state.targetZ = slotEntranceZ - 1.25; // Pushed deep inside the slot cavity
        state.targetRotX = 1.57;
        state.targetRotY = slotFaceAngleY;
        state.targetRotZ = 0;
        state.targetScale = 0.95;
        if (cardGroupRef.current) cardGroupRef.current.visible = true;
      } else if (curStatus === 'verifying') {
        // STEP 3: Card is 100% INSIDE the machine cavity
        state.targetX = slotEntranceX;
        state.targetY = slotEntranceY;
        state.targetZ = slotEntranceZ - 1.8; // Fully swallowed inside ATM
        state.targetRotX = 1.57;
        state.targetRotY = slotFaceAngleY;
        state.targetRotZ = 0;
        state.targetScale = 0.95;
      } else if (curStatus === 'ejecting') {
        // STEP 4: Motor pushes card out of the slot mouth
        if (cardGroupRef.current) cardGroupRef.current.visible = true;
        state.targetX = slotEntranceX;
        state.targetY = slotEntranceY;
        state.targetZ = slotEntranceZ + 0.55; // pushed out of slot into user view
        state.targetRotX = 1.57;
        state.targetRotY = slotFaceAngleY;
        state.targetRotZ = 0;
        state.targetScale = 0.95;
      } else if (curStatus === 'granted' || curStatus === 'denied') {
        // STEP 5: Card returns to front-right tray in full user view
        if (cardGroupRef.current) cardGroupRef.current.visible = true;
        state.targetX = curMobile ? 1.05 : 1.65;
        state.targetY = -0.1;
        state.targetZ = 1.1;
        state.targetRotX = -0.15;
        state.targetRotY = -0.32;
        state.targetRotZ = 0.05;
        state.targetScale = curMobile ? 0.9 : 1.0;
      }

      // Smooth Physics LERP Speed
      let lerpSpeed = 0.08;
      if (curStatus === 'aligning') lerpSpeed = 0.12;
      else if (curStatus === 'inserting') lerpSpeed = 0.10;
      else if (curStatus === 'verifying') lerpSpeed = 0.14;
      else if (curStatus === 'ejecting') lerpSpeed = 0.11;

      if (cardGroupRef.current) {
        const cg = cardGroupRef.current;
        cg.position.x += (state.targetX - cg.position.x) * lerpSpeed;
        cg.position.y += (state.targetY - cg.position.y) * lerpSpeed;
        cg.position.z += (state.targetZ - cg.position.z) * lerpSpeed;

        cg.rotation.x += (state.targetRotX - cg.rotation.x) * lerpSpeed;
        cg.rotation.y += (state.targetRotY - cg.rotation.y) * lerpSpeed;
        cg.rotation.z += (state.targetRotZ - cg.rotation.z) * lerpSpeed;

        const currentScale = cg.scale.x;
        const s = currentScale + (state.targetScale - currentScale) * lerpSpeed;
        cg.scale.set(s, s, s);

        // When verifying and card has slid fully past slot entrance, hide card completely
        if (curStatus === 'verifying' && cg.position.z < slotEntranceZ - 0.4) {
          cg.visible = false;
        }
      }

      // Dynamic Slot Aperture Light & Laser Strip Animation
      if (slotLightRef.current) {
        if (curStatus === 'granted') {
          slotLightRef.current.color.setHex(0x10b981);
          slotLightRef.current.intensity = 5.0 + Math.sin(time * 12) * 2.0;
          if (laserStripRef.current) {
            (laserStripRef.current.material as THREE.MeshBasicMaterial).color.setHex(0x10b981);
          }
        } else if (curStatus === 'denied') {
          slotLightRef.current.color.setHex(0xf43f5e);
          slotLightRef.current.intensity = 5.0 + Math.sin(time * 12) * 2.0;
          if (laserStripRef.current) {
            (laserStripRef.current.material as THREE.MeshBasicMaterial).color.setHex(0xf43f5e);
          }
        } else if (curStatus === 'verifying') {
          slotLightRef.current.color.setHex(0x22d3ee);
          slotLightRef.current.intensity = 4.5 + Math.sin(time * 14) * 2.5;
          if (laserStripRef.current) {
            (laserStripRef.current.material as THREE.MeshBasicMaterial).color.setHex(0x22d3ee);
          }
        } else if (curStatus === 'aligning' || curStatus === 'inserting') {
          slotLightRef.current.color.setHex(0x38bdf8);
          slotLightRef.current.intensity = 4.0 + Math.sin(time * 8) * 1.5;
          if (laserStripRef.current) {
            (laserStripRef.current.material as THREE.MeshBasicMaterial).color.setHex(0x38bdf8);
          }
        } else {
          slotLightRef.current.color.setHex(0x34d399);
          slotLightRef.current.intensity = 2.8 + Math.sin(time * 3) * 0.8;
          if (laserStripRef.current) {
            (laserStripRef.current.material as THREE.MeshBasicMaterial).color.setHex(0x34d399);
          }
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handlePointerMove);
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isMobile]);

  return (
    <div className="relative w-full h-[360px] sm:h-[400px] lg:h-[420px] rounded-3xl overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-2 border-slate-700/80 shadow-[inset_0_2px_12px_rgba(0,0,0,0.9),0_20px_40px_rgba(0,0,0,0.8)] select-none">
      {/* ThreeJS WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Overlays */}
      <div className="absolute top-3 left-3 flex items-center gap-2 bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700 text-[10px] font-mono text-cyan-300">
        <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
        <span>THREE.JS 3D PHYSICAL ATM (SLOT INTAKE ENGINE)</span>
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-xl border border-white/10 text-[10px] font-mono text-slate-300">
        <span>
          কার্ড স্ট্যাটাস:{' '}
          {status === 'idle'
            ? 'ট্রে-তে প্রস্তুত'
            : status === 'aligning'
            ? 'স্লটের মুখে অবস্থান'
            : status === 'inserting'
            ? 'মেশিনের ভেতর ঢুকছে...'
            : status === 'verifying'
            ? 'মেশিনের ভেতরে লকড & স্ক্যানিং'
            : status === 'ejecting'
            ? 'মেশিন থেকে বের হচ্ছে...'
            : status === 'granted'
            ? 'সফল ও বের হয়েছে'
            : 'বের হয়ে ফেরত এসেছে'}
        </span>
      </div>

      {/* Bottom Hint */}
      <div className="absolute bottom-2.5 right-3 text-[10px] text-slate-300 bg-black/75 backdrop-blur-xs px-2.5 py-1 rounded-lg border border-white/10 pointer-events-none font-mono">
        {status === 'idle'
          ? '💳 লগইন চাপলে কার্ড শূন্যে ভেসে সরাসরি স্লটের ভেতর ঢুকবে'
          : status === 'verifying'
          ? '🔒 কার্ড মেশিনের ভেতরে সম্পূর্ণ প্রবেশ করেছে — ডেটা যাচাই চলছে...'
          : '⚡ 3D মেকানিক্যাল কার্ড মুভমেন্ট...'}
      </div>
    </div>
  );
};
