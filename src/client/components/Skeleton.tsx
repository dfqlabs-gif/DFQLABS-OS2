import React from "react";

interface SkeletonProps {
  height?: string;
  width?: string;
  borderRadius?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  height = "20px",
  width = "100%",
  borderRadius = "var(--radius-sm)",
  style
}) => {
  return (
    <div
      className="skeleton"
      style={{
        height,
        width,
        borderRadius,
        ...style
      }}
    />
  );
};
