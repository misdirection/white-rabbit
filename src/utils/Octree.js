/**
 * @file Octree.js
 * @description Spatial indexing data structure for efficient 3D point queries.
 *
 * Implements an octree (8-tree) for fast star lookup in 3D space. Recursively subdivides
 * space into 8 octants when node capacity is exceeded, enabling O(log n) queries instead
 * of O(n) brute-force searches.
 *
 * Key features:
 * - Ray intersection queries with expansion threshold
 * - Configurable node capacity (default: 64 points)
 * - Automatic subdivision when capacity exceeded
 * - Used for star selection in tooltips (500 AU query threshold)
 *
 * Performance: With 100k+ stars, reduces tooltip hover checks from millions to hundreds.
 */
import * as THREE from 'three';

const _box = new THREE.Box3();


export class Octree {
  constructor(bounds, capacity = 64) {
    this.bounds = bounds; // THREE.Box3
    this.capacity = capacity;
    this.points = [];
    this.children = null; // Array of 8 Octrees if subdivided
    this.divided = false;
  }

  insert(point) {
    if (!this.bounds.containsPoint(point.position)) {
      return false;
    }

    if (this.points.length < this.capacity && !this.divided) {
      this.points.push(point);
      return true;
    }

    if (!this.divided) {
      this.subdivide();
    }

    return (
      this.children[0].insert(point) ||
      this.children[1].insert(point) ||
      this.children[2].insert(point) ||
      this.children[3].insert(point) ||
      this.children[4].insert(point) ||
      this.children[5].insert(point) ||
      this.children[6].insert(point) ||
      this.children[7].insert(point)
    );
  }

  subdivide() {
    const min = this.bounds.min;
    const max = this.bounds.max;
    const mid = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);

    const childrenBounds = [
      // Bottom 4
      new THREE.Box3(min, mid),
      new THREE.Box3(
        new THREE.Vector3(mid.x, min.y, min.z),
        new THREE.Vector3(max.x, mid.y, mid.z)
      ),
      new THREE.Box3(
        new THREE.Vector3(min.x, min.y, mid.z),
        new THREE.Vector3(mid.x, mid.y, max.z)
      ),
      new THREE.Box3(
        new THREE.Vector3(mid.x, min.y, mid.z),
        new THREE.Vector3(max.x, mid.y, max.z)
      ),
      // Top 4
      new THREE.Box3(
        new THREE.Vector3(min.x, mid.y, min.z),
        new THREE.Vector3(mid.x, max.y, mid.z)
      ),
      new THREE.Box3(
        new THREE.Vector3(mid.x, mid.y, min.z),
        new THREE.Vector3(max.x, max.y, mid.z)
      ),
      new THREE.Box3(
        new THREE.Vector3(min.x, mid.y, mid.z),
        new THREE.Vector3(mid.x, max.y, max.z)
      ),
      new THREE.Box3(mid, max),
    ];

    this.children = childrenBounds.map((b) => new Octree(b, this.capacity));
    this.divided = true;

    // Move existing points to children
    for (const p of this.points) {
      for (const child of this.children) {
        if (child.insert(p)) break;
      }
    }
    this.points = [];
  }

  queryRay(ray, threshold = 0, result = []) {
    // Check intersection with expanded bounds if threshold > 0
    if (threshold > 0) {
      _box.copy(this.bounds).expandByScalar(threshold);
      if (!ray.intersectsBox(_box)) {
        return result;
      }
    } else {
      if (!ray.intersectsBox(this.bounds)) {
        return result;
      }
    }

    if (this.points.length > 0) {
      for (const p of this.points) {
        result.push(p);
      }
    }

    if (this.children) {
      for (const child of this.children) {
        child.queryRay(ray, threshold, result);
      }
    }

    return result;
  }
}
