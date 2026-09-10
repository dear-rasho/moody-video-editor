export const featureKey = 'text';

export function open({ router, item }) {
  const textItems = [
    { 
      key: 'addText', 
      label: 'Add Text', 
      icon: '➕',
      children: [
        { 
          key: 'textContent', 
          label: 'Text', 
          type: 'text', 
          default: 'Hello World',
          placeholder: 'Enter text...'
        }
      ]
    },
    { 
      key: 'fontSize', 
      label: 'Size', 
      icon: '🔤',
      children: [
        { 
          key: 'fontSize', 
          label: 'Size', 
          type: 'slider', 
          min: 10, 
          max: 120, 
          default: 36, 
          suffix: 'px' 
        }
      ]
    },
    { 
      key: 'fontColor', 
      label: 'Color', 
      icon: '🎨',
      children: [
        { 
          key: 'fontColor', 
          label: 'Color', 
          type: 'color', 
          default: '#ffffff' 
        }
      ]
    },
    { 
      key: 'fontFamily', 
      label: 'Font', 
      icon: '🔡',
      children: [
        { 
          key: 'fontFamily', 
          label: 'Font', 
          type: 'select', 
          options: ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia', 'Verdana'],
          default: 'Arial'
        }
      ]
    },
    { 
      key: 'alignment', 
      label: 'Align', 
      icon: '↔️',
      children: [
        { 
          key: 'alignment', 
          label: 'Align', 
          type: 'select',
          options: ['Left', 'Center', 'Right'],
          default: 'Center'
        }
      ]
    },
    { 
      key: 'fontWeight', 
      label: 'Bold', 
      icon: '⬛',
      children: [
        { 
          key: 'fontWeight', 
          label: 'Bold', 
          type: 'toggle',
          default: false
        }
      ]
    },
    { 
      key: 'fontStyle', 
      label: 'Italic', 
      icon: '💬',
      children: [
        { 
          key: 'fontStyle', 
          label: 'Italic', 
          type: 'toggle',
          default: false
        }
      ]
    }
  ];

  router.openLevel('text', textItems, { title: 'Text', level: 1 });
}``