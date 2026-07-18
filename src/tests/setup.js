import '@testing-library/jest-dom/vitest'

// Seed the live-Bible math layer for tests.
//
// The APP reads the Bible at runtime over the network (bible-client) and is BANNED
// from importing it at build time. A TEST is not the app: it may import the shared
// standards package directly to seed constants.js so the math modules and rendered
// components have their numbers without a live fetch. The values come from the same
// canonical source the live Bible is built from, so tests exercise the real numbers
// (residential pads 0/0.15/0.30, appraisal $4k, environmental $3.5k, etc.).
import STANDARDS from 'shared-underwriting-standards'
import { setBible } from '../math/constants.js'

setBible(STANDARDS)
