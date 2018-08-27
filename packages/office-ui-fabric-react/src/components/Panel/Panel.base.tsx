import * as React from 'react';

import {
  BaseComponent,
  classNamesFunction,
  divProperties,
  getId,
  getNativeProps,
  getRTL,
  createRef,
  elementContains,
  allowScrollOnElement,
  isIOS
} from '../../Utilities';
import { IProcessedStyleSet, getTheme, IconFontSizes } from '../../Styling';
import { FocusTrapZone } from '../FocusTrapZone/index';
import { IPanel, IPanelProps, PanelType, IPanelStyleProps, IPanelStyles } from './Panel.types';
import { Layer } from '../../Layer';
import { Overlay } from '../../Overlay';
import { Popup } from '../../Popup';
import { IconButton } from '../../Button';

const getClassNames = classNamesFunction<IPanelStyleProps, IPanelStyles>();

export interface IPanelState {
  isFooterSticky?: boolean;
  isOpen?: boolean;
  isAnimating?: boolean;
  id?: string;
}

export class PanelBase extends BaseComponent<IPanelProps, IPanelState> implements IPanel {
  public static defaultProps: IPanelProps = {
    isHiddenOnDismiss: false,
    isOpen: false,
    isBlocking: true,
    hasCloseButton: true,
    type: PanelType.smallFixedFar
  };

  private _panel = createRef<HTMLDivElement>();
  private _content = createRef<HTMLDivElement>();
  private _classNames: IProcessedStyleSet<IPanelStyles>;
  private _scrollableContent: HTMLDivElement | null;

  constructor(props: IPanelProps) {
    super(props);

    this._warnDeprecations({
      ignoreExternalFocusing: 'focusTrapZoneProps',
      forceFocusInsideTrap: 'focusTrapZoneProps',
      firstFocusableSelector: 'focusTrapZoneProps'
    });

    this.state = {
      isFooterSticky: false,
      isOpen: false,
      isAnimating: false,
      id: getId('Panel')
    };
  }

  public componentDidMount(): void {
    this._events.on(window, 'resize', this._updateFooterPosition);

    if (this._shouldListenForOuterClick(this.props)) {
      this._events.on(document.body, 'mousedown', this._dismissOnOuterClick, true);
    }

    if (this.props.isOpen) {
      this.open();
    }
  }

  public componentDidUpdate(previousProps: IPanelProps): void {
    const shouldListenOnOuterClick = this._shouldListenForOuterClick(this.props);
    const previousShouldListenOnOuterClick = this._shouldListenForOuterClick(previousProps);

    if (shouldListenOnOuterClick && !previousShouldListenOnOuterClick) {
      this._events.on(document.body, 'mousedown', this._dismissOnOuterClick, true);
    } else if (!shouldListenOnOuterClick && previousShouldListenOnOuterClick) {
      this._events.off(document.body, 'mousedown', this._dismissOnOuterClick, true);
    }
  }

  public componentWillReceiveProps(newProps: IPanelProps): void {
    if (newProps.isOpen !== this.state.isOpen) {
      if (newProps.isOpen) {
        this.open();
      } else {
        this.dismiss();
      }
    }
  }

  public render(): JSX.Element | null {
    const {
      className = '',
      elementToFocusOnDismiss,
      firstFocusableSelector,
      focusTrapZoneProps,
      forceFocusInsideTrap,
      hasCloseButton,
      headerText,
      headerClassName = '',
      ignoreExternalFocusing,
      isBlocking,
      isFooterAtBottom,
      isLightDismiss,
      isHiddenOnDismiss,
      layerProps,
      type,
      styles,
      theme,
      customWidth,
      onLightDismissClick = this._onPanelClick,
      onRenderNavigation = this._onRenderNavigation,
      onRenderHeader = this._onRenderHeader,
      onRenderBody = this._onRenderBody,
      onRenderFooter = this._onRenderFooter
    } = this.props;
    const { isFooterSticky, isOpen, isAnimating, id } = this.state;
    const isLeft = type === PanelType.smallFixedNear ? true : false;
    const isRTL = getRTL();
    const isOnRightSide = isRTL ? isLeft : !isLeft;
    const headerTextId = headerText && id + '-headerText';
    const customWidthStyles = type === PanelType.custom ? { width: customWidth } : {};
    const nativeProps = getNativeProps(this.props, divProperties);

    if (!isOpen && !isAnimating && !isHiddenOnDismiss) {
      return null;
    }

    this._classNames = getClassNames(styles!, {
      theme: theme!,
      className,
      focusTrapZoneClassName: focusTrapZoneProps ? focusTrapZoneProps.className : undefined,
      hasCloseButton,
      headerClassName,
      isAnimating: this.state.isAnimating,
      isFooterAtBottom,
      isFooterSticky,
      isOnRightSide,
      isOpen: this.state.isOpen,
      isHiddenOnDismiss,
      type
    });

    const { _classNames } = this;

    let overlay;
    if (isBlocking && isOpen) {
      overlay = (
        <Overlay
          className={_classNames.overlay}
          isDarkThemed={false}
          onClick={isLightDismiss ? onLightDismissClick : undefined}
        />
      );
    }

    const header = onRenderHeader(this.props, this._onRenderHeader, headerTextId);

    return (
      <Layer {...layerProps}>
        <Popup
          role="dialog"
          ariaLabelledBy={header ? headerTextId : undefined}
          onDismiss={this.dismiss}
          className={_classNames.hiddenPanel}
        >
          <div {...nativeProps} ref={this._panel} className={_classNames.root}>
            {overlay}
            <FocusTrapZone
              ignoreExternalFocusing={ignoreExternalFocusing}
              forceFocusInsideTrap={isHiddenOnDismiss && !isOpen ? false : forceFocusInsideTrap}
              firstFocusableSelector={firstFocusableSelector}
              {...focusTrapZoneProps}
              className={_classNames.main}
              style={customWidthStyles}
              elementToFocusOnDismiss={elementToFocusOnDismiss}
              isClickableOutsideFocusTrap={
                focusTrapZoneProps && !focusTrapZoneProps.isClickableOutsideFocusTrap ? false : true
              }
            >
              <div ref={this._allowScrollOnPanel} className={_classNames.scrollableContent}>
                <div className={_classNames.commands} data-is-visible={true}>
                  {onRenderNavigation(this.props, this._onRenderNavigation)}
                </div>
                <div className={_classNames.contentInner}>
                  {header}
                  {onRenderBody(this.props, this._onRenderBody)}
                  {onRenderFooter(this.props, this._onRenderFooter)}
                </div>
              </div>
            </FocusTrapZone>
          </div>
        </Popup>
      </Layer>
    );
  }

  public open() {
    if (!this.state.isOpen) {
      this.setState(
        {
          isOpen: true,
          isAnimating: true
        },
        () => {
          this._async.setTimeout(this._onTransitionComplete, 200);
        }
      );
    }
  }

  public dismiss = (): void => {
    if (this.state.isOpen) {
      this.setState(
        {
          isOpen: false,
          isAnimating: true
        },
        () => {
          this._async.setTimeout(this._onTransitionComplete, 200);
        }
      );

      if (this.props.onDismiss) {
        this.props.onDismiss();
      }
    }
  };

  // Allow the user to scroll within the panel but not on the body
  private _allowScrollOnPanel = (elt: HTMLDivElement | null): void => {
    if (elt) {
      allowScrollOnElement(elt, this._events);
      if (isIOS()) {
        elt.style.height = window.innerHeight + 'px';
      }
    } else {
      this._events.off(this._scrollableContent);
    }
    this._scrollableContent = elt;
  };

  private _shouldListenForOuterClick(props: IPanelProps): boolean {
    return !!props.isBlocking && !!props.isOpen;
  }

  private _onRenderNavigation = (props: IPanelProps): JSX.Element | null => {
    const { closeButtonAriaLabel, hasCloseButton } = props;
    const theme = getTheme();
    if (hasCloseButton) {
      // TODO -Issue #5689: Comment in once Button is converted to mergeStyles
      // const iconButtonStyles = this._classNames.subComponentStyles
      // ? (this._classNames.subComponentStyles.iconButton as IStyleFunctionOrObject<IButtonStyleProps, IButtonStyles>)
      // : undefined;
      return (
        <div className={this._classNames.navigation}>
          <IconButton
            // TODO -Issue #5689: Comment in once Button is converted to mergeStyles
            // className={iconButtonStyles}
            styles={{
              root: {
                height: 'auto',
                width: '44px',
                color: theme.palette.neutralSecondary,
                fontSize: IconFontSizes.large
              },
              rootHovered: {
                color: theme.palette.neutralPrimary
              }
            }}
            className={this._classNames.closeButton}
            onClick={this._onPanelClick}
            ariaLabel={closeButtonAriaLabel}
            data-is-visible={true}
            iconProps={{ iconName: 'Cancel' }}
          />
        </div>
      );
    }
    return null;
  };

  private _onRenderHeader = (
    props: IPanelProps,
    defaultRender?: (props?: IPanelProps) => JSX.Element | null,
    headerTextId?: string | undefined
  ): JSX.Element | null => {
    const { headerText } = props;

    if (headerText) {
      return (
        <div className={this._classNames.header}>
          <p className={this._classNames.headerText} id={headerTextId} role="heading" aria-level={2}>
            {headerText}
          </p>
        </div>
      );
    }
    return null;
  };

  private _onRenderBody = (props: IPanelProps): JSX.Element => {
    return (
      <div ref={this._content} className={this._classNames.content} data-is-scrollable={true}>
        {props.children}
      </div>
    );
  };

  private _onRenderFooter = (props: IPanelProps): JSX.Element | null => {
    const { onRenderFooterContent = null } = this.props;
    if (onRenderFooterContent) {
      return (
        <div className={this._classNames.footer}>
          <div className={this._classNames.footerInner}>{onRenderFooterContent()}</div>
        </div>
      );
    }
    return null;
  };

  private _updateFooterPosition(): void {
    const _content = this._content.current;
    if (_content) {
      const height = _content.clientHeight;
      const innerHeight = _content.scrollHeight;

      this.setState({
        isFooterSticky: height < innerHeight ? true : false
      });
    }
  }

  private _dismissOnOuterClick(ev: any): void {
    const panel = this._panel.current;
    if (this.state.isOpen && panel) {
      if (!elementContains(panel, ev.target)) {
        if (this.props.onOuterClick) {
          this.props.onOuterClick();
          ev.preventDefault();
        } else {
          this.dismiss();
        }
      }
    }
  }

  private _onPanelClick = (): void => {
    this.dismiss();
  };

  private _onTransitionComplete = (): void => {
    this.setState({
      isAnimating: false
    });

    if (!this.state.isOpen && this.props.onDismissed) {
      this.props.onDismissed();
    }
  };
}
