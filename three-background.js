/**
 * Flowing Tendril Sculpture - Optimized Rendering Pipeline
 * Performance improvements WITHOUT sacrificing visual quality
 */

(function() {
    'use strict';

    // ============================================
    // PERFORMANCE CONFIGURATION
    // ============================================

    const PERFORMANCE_CONFIG = {
        // Pixel ratio cap (prevents excessive resolution on Retina displays)
        maxPixelRatio: 1.5,

        // Target FPS (reasonable cap to prevent excessive rendering)
        targetFPS: 45,
        frameInterval: 1000 / 45,

        // Visibility optimization
        pauseWhenHidden: true
    };

    // Configuration - FULL VISUAL QUALITY PRESERVED
    const CONFIG = {
        dark: {
            background: 0x050608,
            fogColor: 0x0a0c10,
            fogDensity: 0.012,

            sculptureBase: 0xa8b8d0,
            sculptureIridescent: 0x5a8fd6,

            keyLightColor: 0x3b7dd6,
            rimLightColor: 0xb83fd3,
            fillLightColor: 0x0ea5e9,
            topLightColor: 0x6366f1,
            ambientIntensity: 0.12
        },
        light: {
            background: 0xe0e6ef,
            fogColor: 0xd0d8e3,
            fogDensity: 0.015,

            sculptureBase: 0x7888a0,
            sculptureIridescent: 0x5a95e5,

            keyLightColor: 0x60a5fa,
            rimLightColor: 0xa855f7,
            fillLightColor: 0x0ea5e9,
            topLightColor: 0x818cf8,
            ambientIntensity: 0.28
        },
        sculpture: {
            // ORIGINAL GEOMETRY COUNTS - NO REDUCTION
            mainTendrils: 20,
            branchTendrils: 8,
            tendrilSegments: 80,
            tendrilRadius: 0.18,
            tendrilRadialSegments: 16,
            spiralRadius: 6,
            spiralHeight: 14,
            spiralTurns: 4.5,
            branchRadius: 12,
            branchHeight: 10,
            flowSpeed: 0.001,
            twistSpeed: 0.0015,
            rotationSpeed: 0.003,
            position: { x: 0, y: 1.5, z: -2 }
        },
        particles: {
            // ORIGINAL PARTICLE COUNT
            count: 150,
            size: 0.04,
            spread: 25,
            depth: 30,
            opacity: 0.25
        },
        camera: {
            x: 0,
            y: 2,
            z: 13,
            fov: 70,
            lookAtY: 1.5
        }
    };

    let currentTheme = 'dark';
    let scene, camera, renderer;
    let sculpture, particles;
    let animationId;
    let time = 0;
    let lastFrameTime = 0;
    let isPageVisible = true;

    // Cached values for performance (reused each frame)
    const tempVector = new THREE.Vector3();
    const cachedSinCos = {
        time2: 0, time3: 0, time4: 0, time5: 0, time6: 0, time8: 0,
        sinTime2: 0, cosTime15: 0, sinTime08: 0, cosTime06: 0, sinTime04: 0
    };

    // ============================================
    // GEOMETRY CREATION (ORIGINAL QUALITY)
    // ============================================

    /**
     * Creates a single flowing tendril - ORIGINAL IMPLEMENTATION
     */
    function createTendril(index, total, isBranch = false) {
        const { tendrilSegments, tendrilRadius, tendrilRadialSegments } = CONFIG.sculpture;
        const points = [];
        const angleOffset = (index / total) * Math.PI * 2;
        const phaseOffset = index * 0.5;

        if (!isBranch) {
            // Main spiral tendrils
            const { spiralRadius, spiralHeight, spiralTurns } = CONFIG.sculpture;

            for (let i = 0; i <= tendrilSegments; i++) {
                const t = i / tendrilSegments;
                const angle = angleOffset + t * spiralTurns * Math.PI * 2;

                const radius = spiralRadius * (0.3 + t * 0.7);
                const height = (t - 0.5) * spiralHeight;

                const noiseX = Math.sin(t * 3 + phaseOffset) * 0.5;
                const noiseY = Math.cos(t * 4 + phaseOffset) * 0.8;
                const noiseZ = Math.sin(t * 5 + phaseOffset) * 0.5;

                const x = Math.cos(angle) * radius + noiseX;
                const y = height + noiseY;
                const z = Math.sin(angle) * radius + noiseZ;

                points.push(new THREE.Vector3(x, y, z));
            }
        } else {
            // Branching tendrils
            const { spiralRadius, branchRadius, branchHeight, spiralHeight } = CONFIG.sculpture;

            for (let i = 0; i <= tendrilSegments; i++) {
                const t = i / tendrilSegments;
                let radius, height, angle;

                if (t < 0.3) {
                    angle = angleOffset + t * 3 * Math.PI * 2;
                    radius = spiralRadius * (0.5 + t * 2);
                    height = (t - 0.5) * spiralHeight;
                } else if (t < 0.7) {
                    const branchT = (t - 0.3) / 0.4;
                    angle = angleOffset + 0.3 * 3 * Math.PI * 2;
                    radius = spiralRadius * 1.1 + (branchRadius - spiralRadius * 1.1) * Math.sin(branchT * Math.PI);
                    height = (branchT - 0.5) * branchHeight;
                } else {
                    const returnT = (t - 0.7) / 0.3;
                    angle = angleOffset + (0.3 * 3 + returnT * 2) * Math.PI * 2;
                    radius = branchRadius * (1 - returnT) + spiralRadius * returnT;
                    height = ((1 - returnT) - 0.5) * branchHeight;
                }

                const noiseX = Math.sin(t * 4 + phaseOffset) * 0.6;
                const noiseY = Math.cos(t * 5 + phaseOffset) * 0.9;
                const noiseZ = Math.sin(t * 6 + phaseOffset) * 0.6;

                const x = Math.cos(angle) * radius + noiseX;
                const y = height + noiseY;
                const z = Math.sin(angle) * radius + noiseZ;

                points.push(new THREE.Vector3(x, y, z));
            }
        }

        const curve = new THREE.CatmullRomCurve3(points);
        const geometry = new THREE.TubeGeometry(
            curve,
            tendrilSegments,
            tendrilRadius * (isBranch ? 0.8 : 1),
            tendrilRadialSegments,
            false
        );

        geometry.userData.originalPositions = geometry.attributes.position.array.slice();
        geometry.userData.phaseOffset = phaseOffset;

        return geometry;
    }

    /**
     * Create sculpture - MERGED GEOMETRY for draw call optimization
     */
    function createSculpture() {
        const group = new THREE.Group();
        const geometries = [];

        // Create main spiral tendrils
        for (let i = 0; i < CONFIG.sculpture.mainTendrils; i++) {
            const geometry = createTendril(i, CONFIG.sculpture.mainTendrils, false);
            geometries.push(geometry);
        }

        // Create branching tendrils
        for (let i = 0; i < CONFIG.sculpture.branchTendrils; i++) {
            const geometry = createTendril(i, CONFIG.sculpture.branchTendrils, true);
            geometries.push(geometry);
        }

        // OPTIMIZATION: Merge all geometries into one (reduces draw calls)
        const mergedGeometry = new THREE.BufferGeometry();
        const positions = [];
        const normals = [];
        const uvs = [];

        for (const geometry of geometries) {
            const pos = geometry.attributes.position.array;
            const norm = geometry.attributes.normal.array;
            const uv = geometry.attributes.uv.array;

            positions.push(...pos);
            normals.push(...norm);
            uvs.push(...uv);

            // Dispose individual geometry after merging
            geometry.dispose();
        }

        mergedGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
        mergedGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(normals), 3));
        mergedGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));

        mergedGeometry.userData.originalPositions = positions.slice();

        // ORIGINAL MATERIAL - FULL QUALITY
        const material = new THREE.MeshPhysicalMaterial({
            color: CONFIG[currentTheme].sculptureBase,
            metalness: 0.88,
            roughness: 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05,
            reflectivity: 1,
            envMapIntensity: 2.0,
            transparent: true,
            opacity: 0.95,
            transmission: 0.2,
            thickness: 2.0,
            ior: 1.6,
            iridescence: 1.0,
            iridescenceIOR: 1.4,
            iridescenceThicknessRange: [100, 1000],
            emissive: CONFIG[currentTheme].sculptureIridescent,
            emissiveIntensity: 0.12,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(mergedGeometry, material);
        group.add(mesh);

        group.position.set(
            CONFIG.sculpture.position.x,
            CONFIG.sculpture.position.y,
            CONFIG.sculpture.position.z
        );

        return { group, mesh, geometry: mergedGeometry };
    }

    /**
     * OPTIMIZED: Efficient vertex animation with cached calculations
     */
    function updateSculptureAnimation(geometry, time) {
        const positions = geometry.attributes.position.array;
        const original = geometry.userData.originalPositions;

        // Cache frequently used time multiplications
        cachedSinCos.time2 = time * 2;
        cachedSinCos.time3 = time * 3;
        cachedSinCos.time4 = time * 4;
        cachedSinCos.time5 = time * 5;
        cachedSinCos.time6 = time * 6;
        cachedSinCos.time8 = time * 8;

        // Optimized loop with cached values
        for (let i = 0; i < positions.length; i += 3) {
            const ox = original[i];
            const oy = original[i + 1];
            const oz = original[i + 2];

            const height = oy;
            const t = (height + 7) / 14;

            // Dramatic flowing wave motion (original complexity)
            const wave1 = Math.sin(t * 4 - cachedSinCos.time8) * 0.6;
            const wave2 = Math.cos(t * 6 + cachedSinCos.time6) * 0.4;
            const wave3 = Math.sin(t * 8 - cachedSinCos.time4) * 0.3;

            // Strong twisting motion
            const twist = Math.sin(cachedSinCos.time5 + t * 4) * 0.25;

            // Dramatic pulsing radius
            const pulse = 1 + Math.sin(cachedSinCos.time3 - t * 2) * 0.25;

            // Get radial direction from center axis
            const radius = Math.sqrt(ox * ox + oz * oz);
            if (radius > 0.01) {
                const nx = ox / radius;
                const nz = oz / radius;

                // Apply strong deformations
                positions[i] = ox * pulse + nx * wave1 + nz * twist;
                positions[i + 1] = oy + wave2 + wave3;
                positions[i + 2] = oz * pulse + nz * wave1 - nx * twist;
            } else {
                positions[i] = ox;
                positions[i + 1] = oy;
                positions[i + 2] = oz;
            }
        }

        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
    }

    /**
     * Creates atmospheric particle field - ORIGINAL QUALITY
     */
    function createParticleField() {
        const { count, size, spread, depth } = CONFIG.particles;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            const radius = Math.random() * spread;

            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = (Math.random() - 0.5) * depth;
            positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta) - 5;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: CONFIG[currentTheme].sculptureIridescent,
            size: size,
            transparent: true,
            opacity: CONFIG.particles.opacity,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true
        });

        return new THREE.Points(geometry, material);
    }

    /**
     * Sets up cinematic lighting - ORIGINAL 4-POINT SETUP
     */
    function createLighting() {
        const lights = {};

        lights.ambient = new THREE.AmbientLight(
            0xffffff,
            CONFIG[currentTheme].ambientIntensity
        );
        scene.add(lights.ambient);

        lights.keyLight = new THREE.DirectionalLight(
            CONFIG[currentTheme].keyLightColor,
            0.9
        );
        lights.keyLight.position.set(6, 8, 10);
        scene.add(lights.keyLight);

        lights.rimLight = new THREE.DirectionalLight(
            CONFIG[currentTheme].rimLightColor,
            0.7
        );
        lights.rimLight.position.set(-8, 3, -6);
        scene.add(lights.rimLight);

        lights.fillLight = new THREE.DirectionalLight(
            CONFIG[currentTheme].fillLightColor,
            0.5
        );
        lights.fillLight.position.set(-6, -3, 8);
        scene.add(lights.fillLight);

        lights.topLight = new THREE.DirectionalLight(
            CONFIG[currentTheme].topLightColor,
            0.6
        );
        lights.topLight.position.set(0, 12, 0);
        scene.add(lights.topLight);

        // Side gradient lights for atmospheric effect
        lights.leftGradient = new THREE.PointLight(0x3b7dd6, 0.4, 25);
        lights.leftGradient.position.set(-17, 2, -7);
        scene.add(lights.leftGradient);

        lights.rightGradient = new THREE.PointLight(0xb83fd3, 0.4, 25);
        lights.rightGradient.position.set(17, 2, -7);
        scene.add(lights.rightGradient);

        scene.userData.lights = lights;
        return lights;
    }

    /**
     * Initialize scene with RENDERING OPTIMIZATIONS ONLY
     */
    function init() {
        const layoutElement = document.querySelector('.layout');
        if (layoutElement && layoutElement.classList.contains('light-theme')) {
            currentTheme = 'light';
        }

        scene = new THREE.Scene();
        scene.background = new THREE.Color(CONFIG[currentTheme].background);
        scene.fog = new THREE.FogExp2(
            CONFIG[currentTheme].fogColor,
            CONFIG[currentTheme].fogDensity
        );

        camera = new THREE.PerspectiveCamera(
            CONFIG.camera.fov,
            window.innerWidth / window.innerHeight,
            0.1,
            100
        );
        camera.position.set(CONFIG.camera.x, CONFIG.camera.y, CONFIG.camera.z);
        camera.lookAt(0, CONFIG.camera.lookAtY, 0);

        // OPTIMIZATION: Renderer settings focused on efficiency
        renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance'
        });

        renderer.setSize(window.innerWidth, window.innerHeight);

        // OPTIMIZATION: Cap pixel ratio to prevent excessive resolution
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, PERFORMANCE_CONFIG.maxPixelRatio));

        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        renderer.outputEncoding = THREE.sRGBEncoding;

        renderer.domElement.id = 'three-background';
        renderer.domElement.style.position = 'fixed';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.zIndex = '-1';
        renderer.domElement.style.pointerEvents = 'none';

        document.body.insertBefore(renderer.domElement, document.body.firstChild);

        sculpture = createSculpture();
        scene.add(sculpture.group);

        particles = createParticleField();
        scene.add(particles);

        createLighting();

        window.addEventListener('resize', onWindowResize);
        observeThemeChanges();
        setupVisibilityHandling();

        animate();

        console.log('[Flowing Sculpture] Initialized - Full visual quality with rendering optimizations');
    }

    /**
     * OPTIMIZATION: Frame-rate limited animation loop
     */
    function animate(currentTime = 0) {
        animationId = requestAnimationFrame(animate);

        // FPS limiting
        const elapsed = currentTime - lastFrameTime;
        if (elapsed < PERFORMANCE_CONFIG.frameInterval) {
            return;
        }
        lastFrameTime = currentTime - (elapsed % PERFORMANCE_CONFIG.frameInterval);

        // Pause when tab hidden
        if (!isPageVisible) {
            return;
        }

        time += CONFIG.sculpture.flowSpeed;

        // Animate tendril flow and deformation
        updateSculptureAnimation(sculpture.geometry, time);

        // Cache sin/cos values for camera drift
        cachedSinCos.sinTime08 = Math.sin(time * 0.8);
        cachedSinCos.cosTime06 = Math.cos(time * 0.6);
        cachedSinCos.sinTime04 = Math.sin(time * 0.4);
        cachedSinCos.sinTime2 = Math.sin(time * 2);
        cachedSinCos.cosTime15 = Math.cos(time * 1.5);

        // Spin the entire sculpture
        sculpture.group.rotation.y += CONFIG.sculpture.rotationSpeed;
        sculpture.group.rotation.x = cachedSinCos.sinTime2 * 0.15;
        sculpture.group.rotation.z = cachedSinCos.cosTime15 * 0.1;

        // Floating motion - up and down
        sculpture.group.position.y = CONFIG.sculpture.position.y + cachedSinCos.sinTime08 * 0.5;

        // Pulsing emissive
        if (sculpture.mesh.material.emissiveIntensity !== undefined) {
            sculpture.mesh.material.emissiveIntensity = 0.12 + Math.sin(time * 4) * 0.04;
        }

        // Particle drift
        const particlePositions = particles.geometry.attributes.position.array;
        const depthHalf = CONFIG.particles.depth / 2;
        for (let i = 0; i < particlePositions.length; i += 3) {
            particlePositions[i + 1] += 0.003;
            if (particlePositions[i + 1] > depthHalf) {
                particlePositions[i + 1] = -depthHalf;
            }
        }
        particles.geometry.attributes.position.needsUpdate = true;

        // Dynamic camera movement
        const driftX = cachedSinCos.sinTime08 * 0.8;
        const driftY = cachedSinCos.cosTime06 * 0.6;
        const driftZ = cachedSinCos.sinTime04 * 0.3;
        camera.position.x = CONFIG.camera.x + driftX;
        camera.position.y = CONFIG.camera.y + driftY;
        camera.position.z = CONFIG.camera.z + driftZ;
        camera.lookAt(0, CONFIG.camera.lookAtY, 0);

        renderer.render(scene, camera);
    }

    /**
     * OPTIMIZATION: Pause animation when tab hidden
     */
    function setupVisibilityHandling() {
        if (!PERFORMANCE_CONFIG.pauseWhenHidden) return;

        document.addEventListener('visibilitychange', () => {
            isPageVisible = !document.hidden;

            if (!isPageVisible) {
                console.log('[Flowing Sculpture] Tab hidden - paused');
            } else {
                console.log('[Flowing Sculpture] Tab visible - resumed');
                lastFrameTime = performance.now();
            }
        });
    }

    function onWindowResize() {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }

    function updateTheme(newTheme) {
        if (newTheme === currentTheme) return;
        currentTheme = newTheme;

        scene.background = new THREE.Color(CONFIG[currentTheme].background);
        scene.fog.color = new THREE.Color(CONFIG[currentTheme].fogColor);
        scene.fog.density = CONFIG[currentTheme].fogDensity;

        if (sculpture && sculpture.mesh) {
            sculpture.mesh.material.color.setHex(CONFIG[currentTheme].sculptureBase);
            sculpture.mesh.material.emissive.setHex(CONFIG[currentTheme].sculptureIridescent);
        }

        if (particles) {
            particles.material.color.setHex(CONFIG[currentTheme].sculptureIridescent);
        }

        const lights = scene.userData.lights;
        if (lights) {
            lights.ambient.intensity = CONFIG[currentTheme].ambientIntensity;
            lights.keyLight.color.setHex(CONFIG[currentTheme].keyLightColor);
            lights.rimLight.color.setHex(CONFIG[currentTheme].rimLightColor);
            lights.fillLight.color.setHex(CONFIG[currentTheme].fillLightColor);
            lights.topLight.color.setHex(CONFIG[currentTheme].topLightColor);
        }
    }

    function observeThemeChanges() {
        const layoutElement = document.querySelector('.layout');
        if (!layoutElement) return;

        const observer = new MutationObserver(() => {
            const isLight = layoutElement.classList.contains('light-theme');
            updateTheme(isLight ? 'light' : 'dark');
        });

        observer.observe(layoutElement, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    function cleanup() {
        if (animationId) cancelAnimationFrame(animationId);

        if (sculpture) {
            if (sculpture.geometry) sculpture.geometry.dispose();
            if (sculpture.mesh && sculpture.mesh.material) sculpture.mesh.material.dispose();
        }

        if (particles) {
            if (particles.geometry) particles.geometry.dispose();
            if (particles.material) particles.material.dispose();
        }

        if (renderer) {
            renderer.dispose();
            if (renderer.domElement && renderer.domElement.parentNode) {
                renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
        }

        window.removeEventListener('resize', onWindowResize);
    }

    if (typeof THREE !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    } else {
        console.error('[Flowing Sculpture] Three.js library not loaded');
    }

    window.cleanupThreeBackground = cleanup;
})();
