import '@testing-library/jest-dom/vitest'

// Seed the Bible singleton from a committed snapshot of the LIVE Bible before any
// test module loads. A test may read the Bible at build time — a test is not the
// app. The APP fetches the live Bible over the network (src/main.jsx via
// bible-client) and must never bundle it. Refresh this snapshot if the Bible shape
// changes. (Was importing the pinned shared-underwriting-standards package, which
// froze the test on an old Bible commit lacking REHAB.nationalPsf.)
import bibleSnapshot from './bibleSnapshot.json'
import { setBible } from '../math/constants.js'

setBible(bibleSnapshot.standards)
