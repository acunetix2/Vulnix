import React from 'react'

export function VulnixLogo({ className = 'size-8 shrink-0', ...props }) {
  return (
    <img
      src="/vulnix-logo.png"
      alt="Vulnix"
      className={className}
      {...props}
    />
  )
}
