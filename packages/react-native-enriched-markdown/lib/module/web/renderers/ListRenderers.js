import { Fragment, useState, useEffect } from 'react';
import { extractNodeText } from '../utils.js';
import { listItemStyle, checkedTaskTextStyle } from '../styles.js';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function ListRenderer({
  node,
  styles,
  parentType,
  renderChildren,
  listTag: ListTag
}) {
  const isNested = parentType === 'ListItem';
  const hasTaskChild = !isNested && node.children?.some(child => child.attributes?.isTask === 'true');
  const resolvedStyle = isNested ? styles.listNested : hasTaskChild ? styles.listTask : styles.list;
  return /*#__PURE__*/_jsx(ListTag, {
    start: ListTag === 'ol' ? Number(node.attributes?.start ?? 1) : undefined,
    style: resolvedStyle,
    children: renderChildren(node)
  });
}
function UnorderedListRenderer(props) {
  return /*#__PURE__*/_jsx(ListRenderer, {
    ...props,
    listTag: "ul"
  });
}
function OrderedListRenderer(props) {
  return /*#__PURE__*/_jsx(ListRenderer, {
    ...props,
    listTag: "ol"
  });
}
function ListItemRenderer({
  node,
  style,
  styles,
  index,
  callbacks,
  capabilities,
  renderChildren
}) {
  const isTask = node.attributes?.isTask === 'true';
  const initialChecked = node.attributes?.taskChecked === 'true';
  const taskText = isTask ? extractNodeText(node) : '';
  const [isChecked, setIsChecked] = useState(initialChecked);
  useEffect(() => {
    setIsChecked(initialChecked);
  }, [initialChecked]);
  const handleChange = () => {
    if (!capabilities.enableTaskListItemToggle) return;
    const taskIndex = node.attributes?.taskIndex;
    if (taskIndex === undefined) return;
    const newChecked = !isChecked;
    setIsChecked(newChecked);
    callbacks.onTaskListItemPress?.({
      index: taskIndex,
      checked: newChecked,
      text: taskText
    });
  };
  const checkedStyle = isTask && isChecked ? checkedTaskTextStyle(style) : undefined;
  const checkbox = isTask ? /*#__PURE__*/_jsx("input", {
    type: "checkbox",
    checked: isChecked,
    onChange: handleChange,
    readOnly: !capabilities.enableTaskListItemToggle,
    "aria-disabled": capabilities.enableTaskListItemToggle ? undefined : true,
    style: capabilities.enableTaskListItemToggle ? styles.taskCheckbox : styles.taskCheckboxDisabled,
    "aria-label": `Task: ${taskText}`
  }) : null;
  return /*#__PURE__*/_jsxs("li", {
    style: listItemStyle(style, isTask, (index ?? 0) === 0),
    children: [!node.children?.length && checkbox, node.children?.map((child, childIndex) => {
      const leadingCheckbox = childIndex === 0 ? checkbox : null;
      const isImageOnly = child.children?.length === 1 && child.children[0]?.type === 'Image';
      if (child.type !== 'Paragraph' || isImageOnly) {
        return /*#__PURE__*/_jsxs(Fragment, {
          children: [leadingCheckbox, renderChildren({
            ...node,
            children: [child]
          })]
        }, childIndex);
      }
      // Keep tight items compact; later paragraphs retain their block gap.
      const paragraphStyle = {
        marginTop: childIndex === 0 ? 0 : style.paragraph.marginBottom,
        marginBottom: 0
      };
      return /*#__PURE__*/_jsxs("p", {
        style: paragraphStyle,
        children: [leadingCheckbox, /*#__PURE__*/_jsx("span", {
          style: checkedStyle,
          children: renderChildren(child)
        })]
      }, childIndex);
    })]
  });
}
export const listRenderers = {
  UnorderedList: UnorderedListRenderer,
  OrderedList: OrderedListRenderer,
  ListItem: ListItemRenderer
};
