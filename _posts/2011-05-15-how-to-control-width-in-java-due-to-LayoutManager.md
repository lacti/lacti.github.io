---
layout: post
title: Java에서 LayoutManager로 인해 width가 뜻대로 안될 때
tags: java -pub
---

Java의 `LayoutManager`는 유연한 component 배치를 위해 parent component의 width에 딱 맞춰서 자식 control을 배치해주는 작업을 수행한다. 그러다보니 자식의 가로 길이를 고정으로 하고 싶은 경우에도 그 크기가 변경되어서 문제가 생기는 경우가 있다.

여러 개의 출력 Pane이 하나의 Container Pane 안에 들어갈 때, Container Pane은 ScrollPane 내에 있어서 여러 개가 들어갈 경우 scrolling이 가능하도록 해보자.

이 때 한 개의 출력 Pane만 들어가게 될 경우에는 지정된 창의 크기가 출력 Pane의 크기보다 커서, `GridLayout` 같은 `LayoutManager`를 쓸 경우 그 출력 Pane의 가로 길이가 ContainerPane의 가로 길이와 같아지는 문제가 발생한다. 즉, Layout이 늘어나버린다.

이를 해결하기 위한 가장 간단한 방법은 `LayoutManager`를 새로 만드는 것이다.
GridLayout을 상속받은 `CustomLayout`을 하나 만들고, layoutContainer method를 override해서 control의 boundary를 지정하는 곳에서 width 값을 고정으로 지정해버리면 해당 문제를 막을 수 있다.

```java
@Override
public void layoutContainer(Container parent) {
	synchronized (parent.getTreeLock()) {
		Insets insets = parent.getInsets();
		int ncomponents = parent.getComponentCount();
		int width = parent.getWidth();
		int height = parent.getHeight();
		int nrows = 1;
		int ncols = paneCount;
		int hgap = getHgap();
		int vgap = getVgap();
		boolean ltr = parent.getComponentOrientation().isLeftToRight();

		if (ncomponents == 0) {
			return;
		}
		if (nrows > 0) {
			ncols = (ncomponents + nrows - 1) / nrows;
		} else {
			nrows = (ncomponents + ncols - 1) / ncols;
		}
		int w = DEFAULT_OUTPUT_WIDTH;
		int h = height - (insets.top + insets.bottom);
		h = (h - (nrows - 1) * vgap) / nrows;

		if (ltr) {
			for (int c = 0, x = insets.left; c < ncols; c++, x += w + hgap) {
				for (int r = 0, y = insets.top; r < nrows; r++, y += h
						+ vgap) {
					int i = r * ncols + c;
					if (i < ncomponents) {
						parent.getComponent(i).setBounds(x, y, w, h);
					}
				}
			}
		} else {
			for (int c = 0, x = width - insets.right - w; c < ncols; c++, x -= w
					+ hgap) {
				for (int r = 0, y = insets.top; r < nrows; r++, y += h
						+ vgap) {
					int i = r * ncols + c;
					if (i < ncomponents) {
						parent.getComponent(i).setBounds(x, y, w, h);
					}
				}
			}
		}
	}
}
```

component 배치는 `GridLayout`과 동일하게 수행하되 22번째 줄에서 볼 수 있듯이 component의 width 값(w)만 고정으로 박아버리면 되겠다.
