import { Fragment, useState, useEffect } from 'react';
import { extractNodeText } from '../utils';
import type { RendererProps, RendererMap } from '../types';
import { listItemStyle, checkedTaskTextStyle } from '../styles';

function ListRenderer({
  node,
  styles,
  parentType,
  renderChildren,
  listTag: ListTag,
}: RendererProps & { listTag: 'ul' | 'ol' }) {
  const isNested = parentType === 'ListItem';
  const hasTaskChild =
    !isNested &&
    node.children?.some((child) => child.attributes?.isTask === 'true');

  const resolvedStyle = isNested
    ? styles.listNested
    : hasTaskChild
      ? styles.listTask
      : styles.list;
  return (
    <ListTag
      start={ListTag === 'ol' ? Number(node.attributes?.start ?? 1) : undefined}
      style={resolvedStyle}
    >
      {renderChildren(node)}
    </ListTag>
  );
}

function UnorderedListRenderer(props: RendererProps) {
  return <ListRenderer {...props} listTag="ul" />;
}

function OrderedListRenderer(props: RendererProps) {
  return <ListRenderer {...props} listTag="ol" />;
}

function ListItemRenderer({
  node,
  style,
  styles,
  index,
  callbacks,
  capabilities,
  renderChildren,
}: RendererProps) {
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
      text: taskText,
    });
  };

  const checkedStyle =
    isTask && isChecked ? checkedTaskTextStyle(style) : undefined;
  const checkbox = isTask ? (
    <input
      type="checkbox"
      checked={isChecked}
      onChange={handleChange}
      readOnly={!capabilities.enableTaskListItemToggle}
      aria-disabled={capabilities.enableTaskListItemToggle ? undefined : true}
      style={
        capabilities.enableTaskListItemToggle
          ? styles.taskCheckbox
          : styles.taskCheckboxDisabled
      }
      aria-label={`Task: ${taskText}`}
    />
  ) : null;

  return (
    <li style={listItemStyle(style, isTask, (index ?? 0) === 0)}>
      {!node.children?.length && checkbox}
      {node.children?.map((child, childIndex) => {
        const leadingCheckbox = childIndex === 0 ? checkbox : null;
        const isImageOnly =
          child.children?.length === 1 && child.children[0]?.type === 'Image';
        if (child.type !== 'Paragraph' || isImageOnly) {
          return (
            <Fragment key={childIndex}>
              {leadingCheckbox}
              {renderChildren({ ...node, children: [child] })}
            </Fragment>
          );
        }
        // Keep tight items compact; later paragraphs retain their block gap.
        const paragraphStyle = {
          marginTop: childIndex === 0 ? 0 : style.paragraph.marginBottom,
          marginBottom: 0,
        };
        return (
          <p key={childIndex} style={paragraphStyle}>
            {leadingCheckbox}
            <span style={checkedStyle}>{renderChildren(child)}</span>
          </p>
        );
      })}
    </li>
  );
}

export const listRenderers: RendererMap = {
  UnorderedList: UnorderedListRenderer,
  OrderedList: OrderedListRenderer,
  ListItem: ListItemRenderer,
};
