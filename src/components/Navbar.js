import React from "react";
import { Link } from "react-router-dom";

export const Navbar = () => {
  return (
    <nav className="primary-nav bg-pink-700">
      <Link to="/">Home</Link>
      <Link to="/about">About</Link>
      <Link to="/device">Device Search</Link>
      <Link to="/products">Products</Link>
    </nav>
  );
};
