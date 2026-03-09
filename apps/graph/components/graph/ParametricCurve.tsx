"use client";

import { memo, useEffect, useMemo } from "react";
import type { ParametricCurveObject } from "@vinculum/scene/types";
import * as THREE from "three";
import { compileParametricExpressions } from "@/lib/math/compileParametric";
import { sampleCurve } from "@/lib/math/sampleCurve";

interface ParametricCurveProps {
  object: ParametricCurveObject;
  isSelected: boolean;
  resolutionMultiplier: number;
  isInteractive: boolean;
}

function ParametricCurveComponent({
  object,
  isSelected,
  resolutionMultiplier,
  isInteractive
}: ParametricCurveProps) {
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);
  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: object.color,
        transparent: true
      }),
    []
  );
  const line = useMemo(() => new THREE.Line(geometry, material), [geometry, material]);

  const adaptiveSamples = useMemo(() => {
    const baseSamples = Math.max(2, Math.floor(object.samples));
    if (!isInteractive) {
      return baseSamples;
    }

    const scaled = Math.max(12, Math.floor(baseSamples * resolutionMultiplier));
    return Math.min(scaled, 50);
  }, [isInteractive, object.samples, resolutionMultiplier]);

  const sampled = useMemo(() => {
    const compiled = compileParametricExpressions(object.xExpr, object.yExpr, object.zExpr);
    if (compiled.error) {
      return null;
    }

    try {
      return sampleCurve(compiled.evaluator, {
        tMin: object.tMin,
        tMax: object.tMax,
        samples: adaptiveSamples,
        clampCoordinate: 10_000
      });
    } catch {
      return null;
    }
  }, [adaptiveSamples, object.tMax, object.tMin, object.xExpr, object.yExpr, object.zExpr]);

  useEffect(() => {
    material.color.set(object.color);
    material.opacity = isSelected ? 1 : 0.9;
    material.needsUpdate = true;
  }, [isSelected, material, object.color]);

  useEffect(() => {
    if (!sampled || sampled.positions.length === 0) {
      geometry.setDrawRange(0, 0);
      return;
    }

    const existing = geometry.getAttribute("position");
    if (
      existing instanceof THREE.BufferAttribute &&
      existing.array instanceof Float32Array &&
      existing.itemSize === 3 &&
      existing.array.length === sampled.positions.length
    ) {
      existing.array.set(sampled.positions);
      existing.needsUpdate = true;
    } else {
      geometry.setAttribute("position", new THREE.BufferAttribute(sampled.positions, 3));
    }

    geometry.computeBoundingSphere();
    geometry.setDrawRange(0, sampled.positions.length / 3);
  }, [geometry, sampled]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  line.visible = sampled !== null && sampled.positions.length > 0;

  return <primitive object={line} />;
}

const ParametricCurve = memo(ParametricCurveComponent);
export default ParametricCurve;
