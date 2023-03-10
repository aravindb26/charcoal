import { CharcoalAbstractTheme } from '@charcoal-ui/theme'
import {
  applyEffect,
  applyEffectToGradient,
  customPropertyToken,
  dur,
  gradient,
  GradientDirection,
} from '@charcoal-ui/utils'
import { CSSObject } from 'styled-components'
import { Context } from 'vm'
import warning from 'warning'
import { objectKeys, objectAssign, isSupportedEffect } from '../util'
import {
  createInternal,
  Internal,
  TRANSITION_DURATION,
  shouldCancelHalfLeading,
} from './internal'
import {
  constFactory,
  factory,
  modifiedFactory,
  onEffectPseudo,
  variable,
} from '../factories/lib'

const colorProperties = ['bg', 'font'] as const
export type ColorProperty = typeof colorProperties[number]

function targetProperty(target: ColorProperty) {
  return target === 'bg' ? 'background-color' : 'color'
}

export const createColorCss =
  <T extends CharcoalAbstractTheme>(_theme: T) =>
  (
    target: ColorProperty,
    color: keyof T['color'],
    effects: readonly (keyof T['effect'])[] = []
  ): Internal => {
    function toCSS() {
      return {
        [targetProperty(target)]: variable(
          customPropertyToken(color.toString())
        ),
        ...effects.filter(isSupportedEffect).reduce<CSSObject>(
          (acc, effect) => ({
            ...acc,
            ...onEffectPseudo(effect, {
              [targetProperty(target)]: variable(
                customPropertyToken(color.toString(), [effect])
              ),
            }),
          }),
          {}
        ),
      }
    }

    return createInternal({
      toCSS,
      context:
        effects.length > 0
          ? target === 'font'
            ? {
                colorTransition: true,
              }
            : {
                backgroundColorTransition: true,
              }
          : {},
    })
  }

export const createGradientColorCss =
  <T extends CharcoalAbstractTheme>(theme: T) =>
  (
    color: keyof T['gradientColor'],
    effects: readonly (keyof T['effect'])[] = [],
    direction: GradientDirection
  ): Internal => {
    const toLinearGradient = gradient(direction)

    function toCSS(context: Context): CSSObject {
      const optimized = !shouldCancelHalfLeading(context)
      const duration = dur(TRANSITION_DURATION)

      if (optimized && effects.length > 0) {
        return {
          position: 'relative',
          zIndex: 0,
          overflow: 'hidden',
          ...effects.filter(isSupportedEffect).reduce<CSSObject>(
            (acc, effect) => ({
              ...acc,
              '&::before': {
                zIndex: -1,
                ...overlayElement,
                transition: `${duration} background-color`,
              },
              '&::after': {
                zIndex: -2,
                ...overlayElement,
                ...toLinearGradient(theme.gradientColor[color]),
              },
              ...onEffectPseudo(effect, {
                '&::before': {
                  backgroundColor: applyEffect(
                    null,
                    theme.effect[effect] ?? []
                  ),
                },
              }),
            }),
            {}
          ),
        }
      }

      warning(
        effects.length === 0,
        // eslint-disable-next-line max-len
        `'Transition' will not be applied. You can get around this by specifying 'preserveHalfLeading' or both 'padding' and 'typograpy'.`
      )

      return {
        ...toLinearGradient(theme.gradientColor[color]),
        ...effects.filter(isSupportedEffect).reduce<CSSObject>(
          (acc, effect) => ({
            ...acc,
            ...onEffectPseudo(effect, {
              ...toLinearGradient(
                applyEffectToGradient(theme.effect[effect] ?? [])(
                  theme.gradientColor[color]
                )
              ),
            }),
          }),
          {}
        ),
      }
    }

    return createInternal({ toCSS })
  }

const overlayElement: CSSObject = {
  content: "''",
  display: 'block',
  position: 'absolute',
  width: '100%',
  height: '100%',
  top: 0,
  left: 0,
}

export default function colors<T extends CharcoalAbstractTheme>(theme: T) {
  const colors = objectKeys(theme.color)
  const effects = objectKeys(theme.effect)

  // 色
  const gradientColors = objectKeys(theme.gradientColor)
  const colorCss = createColorCss(theme)
  const gradientColorCss = createGradientColorCss(theme)

  const colorObject = constFactory(
    {},
    {
      bg: objectAssign(
        factory({}, colors, (color) =>
          modifiedFactory(effects, (modifiers) =>
            colorCss('bg', color, modifiers)
          )
        ),
        factory(
          {},
          gradientColors,
          (color) => (direction: GradientDirection) =>
            modifiedFactory(effects, (modifiers) =>
              gradientColorCss(color, modifiers, direction)
            )
        )
      ),
      font: factory({}, colors, (color) =>
        modifiedFactory(effects, (modifiers) =>
          colorCss('font', color, modifiers)
        )
      ),
    }
  )

  return colorObject
}
