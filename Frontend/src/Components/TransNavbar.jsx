import React from 'react';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { Link, NavLink } from 'react-router-dom';
import '../css/TransNavbar.css';

export default function TransNavbar() {
  return (
    <Navbar expand="lg" className="navbar-custom bg-black px-3 fixed-top">
      <Container fluid>
        <Navbar.Brand as={Link} to="/" className="brand-logo">
          <span className="brand-icon">🚆</span>
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
