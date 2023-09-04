#!/usr/bin/env node --no-warnings

import { kernel } from '../index.js'

kernel.handle(process.argv.slice(2)).catch(console.error)
