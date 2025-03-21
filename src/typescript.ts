import type { CompilerOptions } from 'typescript'
import { resolve, dirname } from 'path'
import { promises as fsp } from 'fs'
import { Module } from 'module'
import pc from 'picocolors'
import { exit, fileExists } from './utils'
import { memoize } from './lib/memoize'
import { DEFAULT_TS_CONFIG } from './constants'
import { logger } from './logger'

export type TypescriptOptions = {
  tsConfigPath: string | undefined
  tsCompilerOptions: CompilerOptions | undefined
}

let hasLoggedTsWarning = false
function resolveTypescript(cwd: string): typeof import('typescript') {
  let ts
  const m = new Module('', undefined)
  m.paths = (Module as any)._nodeModulePaths(cwd)
  try {
    // Bun does not yet support the `Module` class properly.
    if (typeof m?.require === 'undefined') {
      const tsPath = require.resolve('typescript', { paths: [cwd] })
      ts = require(tsPath)
    } else {
      ts = m.require('typescript')
    }
  } catch (e) {
    console.error(e)
    if (!hasLoggedTsWarning) {
      hasLoggedTsWarning = true
      exit(
        'Could not load TypeScript compiler. Try to install `typescript` as dev dependency',
      )
    }
  }
  return ts
}

export const resolveTsConfigPath = memoize(
  (
    cwd: string,
    tsconfigFileName: string | undefined = 'tsconfig.json',
  ): string | undefined => {
    let tsConfigPath: string | undefined
    tsConfigPath = resolve(cwd, tsconfigFileName)
    return fileExists(tsConfigPath) ? tsConfigPath : undefined
  },
)

function resolveTsConfigHandler(
  cwd: string,
  tsConfigPath: string | undefined,
): null | TypescriptOptions {
  let tsCompilerOptions: CompilerOptions = {}
  if (tsConfigPath) {
    // Use the original ts handler to avoid memory leak
    const ts = resolveTypescript(cwd)
    const basePath = tsConfigPath ? dirname(tsConfigPath) : cwd
    const tsconfigJSON = ts.readConfigFile(tsConfigPath, ts.sys.readFile).config
    tsCompilerOptions = ts.parseJsonConfigFileContent(
      tsconfigJSON,
      ts.sys,
      basePath,
    ).options
  } else {
    return null
  }
  return {
    tsCompilerOptions,
    tsConfigPath,
  }
}

export const resolveTsConfig = memoize(resolveTsConfigHandler)

export async function convertCompilerOptions(cwd: string, json: any) {
  // Use the original ts handler to avoid memory leak
  const ts = resolveTypescript(cwd)
  return ts.convertCompilerOptionsFromJson(json, './')
}

export async function writeDefaultTsconfig(tsConfigPath: string) {
  await fsp.writeFile(
    tsConfigPath,
    JSON.stringify(DEFAULT_TS_CONFIG, null, 2),
    'utf-8',
  )
  logger.log(
    `Detected using TypeScript but tsconfig.json is missing, created a ${pc.blue(
      'tsconfig.json',
    )} for you.`,
  )
}
