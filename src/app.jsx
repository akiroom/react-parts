/*jshint esnext:true, browserify:true */
'use strict';

import 'babel/polyfill';
import React from 'react/addons';
import Router from 'react-router';
import StylingMixin from './helpers/styling-mixin.jsx';
import getSearchResults from './helpers/get-search-results';
import Navbar from './components/navbar-component.jsx';
import ComponentList from './components/list-component.jsx';
import {Tabs, Tab} from './components/tabs-component.jsx';
import Pagination from './components/pagination-component.jsx';
import Footer from './components/footer-component.jsx';
import Twitter from './components/twitter-component.jsx';
import Readme from './components/readme-component.jsx';

let Route = Router.Route;
let RouteHandler = Router.RouteHandler;

export var App = React.createClass({
  mixins: [StylingMixin],
  contextTypes: {
    router: React.PropTypes.func
  },
  propTypes: {
    params: React.PropTypes.object.isRequired,
    query: React.PropTypes.object.isRequired,
    initialComponents: React.PropTypes.array.isRequired,
    initialCount: React.PropTypes.number.isRequired,
    perPage: React.PropTypes.number.isRequired,
    debugMode: React.PropTypes.bool.isRequired,
  },
  getInitialState() {
    return {
      components: this.props.initialComponents,
      count: this.props.initialCount
    };
  },
  render() {
    let title = "React.parts";
    let type = this.props.params.type;
    let search = this.props.query.search;
    let searchInputQuery = search ? decodeURIComponent(search) : null;
    let components = this.state.components;
    let debugMode = this.props.debugMode;
    let contentMaxWidth = this.state.showReadme ? 1280 : 730;
    let panelWidth = this.state.showReadme ? "50%" : "100%";

    let styles = {
      container:  {
        cursor: "default",
        fontFamily: "Source Sans Pro, sans-serif",
        fontSize: this.remCalc(20),
        lineHeight: "1.5",
        width: "100%"
      },
      content: {
        margin: "0 auto",
        maxWidth: this.remCalc(contentMaxWidth),
        fontSize: this.remCalc(15),
        padding: this.remCalc(10),
        paddingTop: this.remCalc(50),
        boxSizing: "border-box"
      },
      mainPanel: {
        float: "left",
        boxSizing: "border-box",
        width: panelWidth
      },
      sidePanel: {
        float: "right",
        padding: this.remCalc(1, 0, 10, 10),
        boxSizing: "border-box",
        width: panelWidth
      }
    };

    return (
      <div style={styles.container}>
        <Navbar
          title={title}
          onSearch={this.handleSearchInput}
          defaultValue={searchInputQuery}
          largeSearch={!!this.state.showReadme}
          searchMaxWidth={contentMaxWidth}
          height={this.remCalc(55)}
        />

        <div style={styles.content}>
          { this.state.showReadme &&
            <div id="side-panel" style={styles.sidePanel}>
              <Readme componentName={ this.state.showReadme } />
            </div> }

          <div id="main-panel" style={styles.mainPanel}>
            <Tabs>
              <Tab to="components" params={{type: "native"}} query={{search}}>React Native</Tab>
              <Tab to="components" params={{type: "web"}} query={{search}}>React for Web</Tab>
            </Tabs>

            <RouteHandler
              components={components}
              debugMode={debugMode}
              loading={this.state.loading}
            />

            <Pagination
              to="components"
              params={this.props.params}
              query={this.props.query}
              currentPage={this.parsePage(this.props.query.page)}
              perPage={this.props.perPage}
              totalItems={this.state.count}
            />

            <Footer />
          </div>
        </div>

        <Twitter />
      </div>
    );
  },
  componentWillReceiveProps(newProps) {
    this.performSearch({
      query: newProps.query.search,
      type: newProps.params.type,
      page: this.parsePage(newProps.query.page) - 1, // In Algolia, pagination starts with 0
      perPage: newProps.perPage,
      production: !newProps.debugMode
    });
  },
  componentDidUpdate(prevProps, prevState) {
    let pageChanged = prevProps.query.page != this.props.query.page;
    let searchChanged = prevProps.query.search != this.props.query.search;

    // If the current page or the search query changed, scroll to the top
    if (pageChanged || searchChanged) {
      window.scrollTo(0, 0);
    }

    let panel = document.getElementById("side-panel");
    if (panel) this.setPositionTop(panel);
  },
  handleSearchInput(searchQuery) {
    let queryParams = Object.assign({}, this.props.query);
    delete queryParams.page; // Reset the current page
    delete queryParams.search; // Reset the current search query if it exists
    if (searchQuery) queryParams.search = searchQuery; // Set the new search query

    this.context.router.transitionTo("/:type", this.props.params, queryParams);
  },
  performSearch(searchOptions) {
    // Clear the list and display loading message
    this.setState({ components: [], count: 0, loading: true });

    getSearchResults(searchOptions, (data) => {
      this.setState({
        components: data.components,
        count: data.searchCount,
        loading: false
      });
    });
  },
  parsePage(page) {
    return Math.max(1, parseInt(page, 10) || 1);
  },
  componentDidMount() {
    document.addEventListener("toggle-component", this.handleToggleComponent, false);
    document.addEventListener("untoggle-component", this.handleUntoggleComponent, false);

    window.addEventListener("scroll", () => {
      let panel = document.getElementById("main-panel");
      if (panel) this.updateStickyPosition(panel);

      panel = document.getElementById("side-panel");
      if (panel) this.updateStickyPosition(panel);
    });
  },
  componentWillUnmount() {
    document.removeEventListener("toggle-component", this.handleToggleComponent);
    document.removeEventListener("untoggle-component", this.handleUntoggleComponent);
  },
  handleToggleComponent(e) {
    let componentName = e.detail;
    this.setState({ showReadme: componentName });
  },
  handleUntoggleComponent(e) {
    this.setState({ showReadme: false });
  },
  updateStickyPosition(panel, paddingTop = 10) {
    let topRelativePos = panel.getBoundingClientRect().top;
    let bottomRelativePos = panel.getBoundingClientRect().bottom;
    let smallerThanScreen = panel.offsetHeight < window.innerHeight;

    // If the element's top is below screen's top or is smaller than the screen, update position top
    if (topRelativePos >= paddingTop || smallerThanScreen) {
      this.setPositionTop(panel);
    // If the element's bottom is above screen's bottom and is not smaller than screen, update position bottom
    } else if (bottomRelativePos < window.innerHeight && !smallerThanScreen) {
      this.setPositionBottom(panel);
    }
  },
  // Set the position at `paddingTop` pixels from the top of the window, or
  // the `defaultOffsetTop` if the scroll position is smaller than that.
  // TODO Improve code by removing magic number (105 = navbar height + top padding)
  setPositionTop(panel, defaultOffsetTop = 105, paddingTop = 10) {
    let scrolledPastDefaultOffset = document.body.scrollTop > defaultOffsetTop;

    if (scrolledPastDefaultOffset) {
      let diff = document.body.scrollTop - defaultOffsetTop + paddingTop;
      panel.style.marginTop = `${ diff }px`;
    } else {
      panel.style.marginTop = "0";
    }
  },
  // Set the position at the bottom of the element
  setPositionBottom(panel) {
    let belowFold = document.body.scrollTop > window.innerHeight;
    let tallerThanScreen = panel.offsetHeight > window.innerHeight;
    let marginTop = parseInt(panel.style.marginTop, 10) || 0;
    let bottomRelativePos = panel.getBoundingClientRect().bottom - marginTop;

    if (belowFold && tallerThanScreen && bottomRelativePos < window.innerHeight) {
      let diff = window.innerHeight - bottomRelativePos;
      panel.style.marginTop = `${ diff }px`;
    } else {
      panel.style.marginTop = "0";
    }
  }
});

export var routes = (
  <Route name="app" path="/" handler={App}>
    <Route name="components" path=":type" handler={ComponentList} />
  </Route>
);

if (typeof(document) !== "undefined") {
  Router.run(routes, Router.HistoryLocation, function(Handler, state) {
    React.render(
      <Handler {...state} {...window.initialData} />,
      document.getElementById("container")
    );
  });
}
