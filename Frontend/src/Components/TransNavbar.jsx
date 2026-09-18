import React from 'react';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { Link, NavLink } from 'react-router-dom';
import '../css/TransNavbar.css';

export default function TransNavbar() {
  return (
    <Navbar expand="lg" className="navbar-custom bg-black px-3 fixed-top">
      <Container fluid>
        <Navbar.Brand as={Link} to="/" className="brand-logo">
          <svg
            className="brand-icon"
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            aria-hidden="true"
          >
            <rect x="4" y="3" width="16" height="13" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <line x1="4" y1="9" x2="20" y2="9" stroke="currentColor" strokeWidth="1.6" />
            <line x1="12" y1="3" x2="12" y2="9" stroke="currentColor" strokeWidth="1.6" />
            <circle cx="8" cy="19" r="1.6" fill="currentColor" />
            <circle cx="16" cy="19" r="1.6" fill="currentColor" />
            <line x1="6" y1="16" x2="4" y2="19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="18" y1="16" x2="20" y2="19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span className="brand-text">TransitFlow</span>
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="main-nav bg-white" />

        <Navbar.Collapse id="main-nav">
          <Nav className="main-nav ms-auto gap-3">
            <Nav.Link as={NavLink} to="/">Home</Nav.Link>
            <Nav.Link as={NavLink} to="/plan">Plan</Nav.Link>
            <Nav.Link as={NavLink} to="/commutes">Commutes</Nav.Link>
          </Nav>

          
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
