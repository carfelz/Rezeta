import type { Preview } from '@storybook/react-vite'
import '../../../design-system/tokens.css'
import '../../../design-system/components.css'
import '../src/index.css'
import '../src/styles/globals.css'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'app',
      values: [
        { name: 'app', value: '#FAFAF7' },
        { name: 'white', value: '#FFFFFF' },
      ],
    },
    layout: 'centered',
  },
}

export default preview
