import React from 'react';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export function HeroSection() {
  return (
    <section className="review-hero">
      <div className="review-container">
        <div className="review-hero-grid">
          <div className="review-heading">
            <p className="review-eyebrow">Code security, ready for review</p>
            <h1>Review security findings in their source context.</h1>
          </div>
          <div className="review-summary">
            <p>From the first scan to a reviewed patch. Understand what was found, inspect the affected code, and decide what to fix.</p>
            <div className="review-actions">
              <Link to="/login" className="review-primary">Connect a repository <ArrowRight size={16} aria-hidden="true" /></Link>
              <a href="#playground" className="review-secondary">View an example <ArrowDown size={15} aria-hidden="true" /></a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
