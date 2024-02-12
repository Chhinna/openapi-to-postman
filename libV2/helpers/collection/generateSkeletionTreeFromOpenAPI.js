let _ = require('lodash'),
  Graph = require('graphlib').Graph,

  PATH_WEBHOOK = 'path~webhook',
  ALLOWED_HTTP_METHODS = {
    get: true,
    head: true,
    post: true,
    put: true,
    patch: true,
    delete: true,
    connect: true,
    options: true,
    trace: true
  },


  /**
   * Creates a unidirectional graph representing the structure of a Postman collection based on an OpenAPI specification.
   * @example
   * generateSkeletionTreeFromOpenAPI(openapi, { includeDeprecated: true })
   * @param {Object} openapi - The OpenAPI specification object.
   * @param {Object} options - Optional parameters for generating the collection structure.
   * @param {boolean} options.includeDeprecated - Flag to determine whether to include deprecated requests in the collection.
   * @returns {Graph} A unidirectional graph representing the structure of the Postman collection.
   * @description
   *   - Creates a new Graph object to store the collection structure.
   *   - Adds a root collection node to the graph.
   *   - Gets all the paths from the OpenAPI specification and sorts them in descending order.
   *   - If there are no paths, the function returns the empty graph.
   *   - For each path, the function creates a base folder for the path and adds and links the requests inside the folder.
   *   - If the path is a single level (e.g. /user), the function creates a folder for the path and adds the requests inside it.
   *   - If the path is multiple levels (e.g. /user/123), the function creates a folder for each level and adds the requests inside the final folder.
   *   - If the path is a single level and the request is deprecated, it is not added to the collection unless the includeDeprecated option is set to true.
   *   - If the path is multiple levels and the request is deprecated, it is not added to the collection unless the includeDeprecated option is set to true.
   *   - The function returns the completed graph representing the Postman collection structure.
   */
  _generateTreeFromPathsV2 = function (openapi, { includeDeprecated }) {
    /**
     * We will create a unidirectional graph
     */
    let tree = new Graph();

    tree.setNode('root:collection', {
      type: 'collection',
      data: {},
      meta: {}
    });

    /**
     * Get all the paths sorted in desc order.
     */
    const paths = Object.keys(openapi.paths);

    if (_.isEmpty(paths)) {
      return tree;
    }

    _.forEach(paths, function (completePath) {
      let pathSplit = completePath === '/' ? [completePath] : _.compact(completePath.split('/'));

      /**
       * /user
       * /team
       * /hi
       * /bye
       *
       * In this scenario, always create a base folder for the path
       * and then add and link the request inside the created folder.
       */
      if (pathSplit.length === 1) {
        let methods = openapi.paths[completePath];

        _.forEach(methods, function (data, method) {
          if (!ALLOWED_HTTP_METHODS[method]) {
            return;
          }

          /**
           * include deprecated handling.
           * If true, add in the postman collection. If false ignore the request.
           */
          if (!includeDeprecated && data.deprecated) {
            return;
          }

          if (!tree.hasNode(`path:folder:${pathSplit[0]}`)) {
            tree.setNode(`path:folder:${pathSplit[0]}`, {
              type: 'folder',
              meta: {
                name: pathSplit[0],
                path: pathSplit[0],
                pathIdentifier: pathSplit[0]
              },
              data: {}
            });

            tree.setEdge('root:collection', `path:folder:${pathSplit[0]}`);
          }

          tree.setNode(`path:request:${pathSplit[0]}:${method}`, {
            type: 'request',
            data: {},
            meta: {
              path: completePath,
              method: method,
              pathIdentifier: pathSplit[0]
            }
          });

          tree.setEdge(`path:folder:${pathSplit[0]}`, `path:request:${pathSplit[0]}:${method}`);
        });
      }

      else {
        _.forEach(pathSplit, function (path, index) {
          let previousPathIdentified = pathSplit.slice(0, index).join('/'),
            pathIdentifier = pathSplit.slice(0, index + 1).join('/');

          if ((index + 1) === pathSplit.length) {
            let methods = openapi.paths[completePath];

            _.forEach(methods, function (data, method) {
              if (!ALLOWED_HTTP_METHODS[method]) {
                return;
              }

              /**
               * include deprecated handling.
               * If true, add in the postman collection. If false ignore the request.
               */
              if (!includeDeprecated && data.deprecated) {
                return;
              }

              /**
               * If it is the last node,
               * it might happen that this exists as a folder.
               *
               * If yes add a request inside that folder else
               * add as a request on the previous path idendified which will be a folder.
               */
              if (!tree.hasNode(`path:folder:${pathIdentifier}`)) {
                tree.setNode(`path:folder:${pathIdentifier}`, {
                  type: 'folder',
                  meta: {
                    name: path,
                    path: path,
                    pathIdentifier: pathIdentifier
                  },
                  data: {}
                });

                tree.setEdge(index === 0 ? 'root:collection' : `path:folder:${previousPathIdentified}`,
                  `path:folder:${pathIdentifier}`);
              }

              tree.setNode(`path:request:${pathIdentifier}:${method}`, {
                type: 'request',
                data: {},
                meta: {
                  path: completePath,
                  method: method,
                  pathIdentifier: pathIdentifier
                }
              });

              tree.setEdge(`path:folder:${pathIdentifier}`, `path:request:${pathIdentifier}:${method}`);
            });
          }

          else {
            let fromNode = index === 0 ? 'root:collection' : `path:folder:${previousPathIdentified}`,
              toNode = `path:folder:${pathIdentifier}`;

            if (!tree.hasNode(toNode)) {
              tree.setNode(toNode, {
                type: 'folder',
                meta: {
                  name: path,
                  path: path,
                  pathIdentifier: pathIdentifier
                },
                data: {}
              });
            }

            if (!tree.hasEdge(fromNode, toNode)) {
              tree.setEdge(fromNode, toNode);
            }
          }
        });
      }
    });

    return tree;
  },

  // _generateTreeFromPaths = function (openapi, { includeDeprecated }) {
  //   /**
  //    * We will create a unidirectional graph
  //    */
  //   let tree = new Graph();

  //   tree.setNode('root:collection', {
  //     type: 'collection',
  //     data: {},
  //     meta: {}
  //   });

  //   _.forEach(openapi.paths, function (methods, path) {
  //     let pathSplit = path === '/' ? [path] : _.compact(path.split('/'));

  //     // if after path split we just have one entry
  //     // that means no folders need to be generated.
  //     // check for all the methods inside it and expand.
  //     if (pathSplit.length === 1) {
  //       /**
  //        * Always first try to find the node if it already exists.
  //        * if yes, bail out nothing is needed to be done.
  //        *
  //        * if the path length is 1, then also generate
  //        * the folder otherwise /pet and /pet/:id will never be in same folder.
  //        */
  //       // if (!tree.hasNode(`path:${pathSplit[0]}`)) {
  //       //   tree.setNode(`path:${pathSplit[0]}`, {
  //       //     type: 'folder',
  //       //     meta: {
  //       //       name: pathSplit[0],
  //       //       path: pathSplit[0],
  //       //       pathIdentifier: pathIdentifier
  //       //     },
  //       //     data: {}
  //       //   });

  //       //   tree.setEdge('root:collection', `path:${pathSplit[0]}`);
  //       // }


  //       _.forEach(methods, function (data, method) {
  //         if (!ALLOWED_HTTP_METHODS[method]) {
  //           return;
  //         }

  //         /**
  //          * include deprecated handling.
  //          * If true, add in the postman collection. If false ignore the request.
  //          */
  //         if (!includeDeprecated && data.deprecated) {
  //           return;
  //         }

  //         tree.setNode(`path:${pathSplit[0]}:${method}`, {
  //           type: 'request',
  //           meta: {
  //             path: path,
  //             method: method,
  //             pathIdentifier: pathSplit[0]
  //           },
  //           data: {}
  //         });

  //         tree.setEdge(`path:${pathSplit[0]}`, `path:${pathSplit[0]}:${method}`);
  //       });
  //     }

  //     else {
  //       _.forEach(pathSplit, function (p, index) {
  //         let previousPathIdentified = pathSplit.slice(0, index).join('/'),
  //           pathIdentifier = pathSplit.slice(0, index + 1).join('/');

  //         /**
  //          * Always first try to find the node if it already exists.
  //          * if yes, bail out nothing is needed to be done.
  //          */
  //         if (tree.hasNode(`path:${pathIdentifier}`)) {
  //           return;
  //         }

  //         else {
  //           tree.setNode(`path:${pathIdentifier}`, {
  //             type: 'folder',
  //             meta: {
  //               name: p,
  //               path: p,
  //               pathIdentifier: pathIdentifier
  //             },
  //             data: {}
  //           });

  //           /**
  //            * If index is 0, this means that we are on the first level.
  //            * Hence it is folder/request to be added on the first level
  //            *
  //            * If after the split we have more than one paths, then we need
  //            * to add to the previous node.
  //            */
  //           tree.setEdge(index === 0 ? 'root:collection' : `path:${previousPathIdentified}`, `path:${pathIdentifier}`);
  //         }
  //       });

  //       /**
  //        * Now for all the methods present in the path, add the request nodes.
  //        */

  //       _.forEach(methods, function (data, method) {
  //         if (!ALLOWED_HTTP_METHODS[method]) {
  //           return;
  //         }

  //         /**
  //          * include deprecated handling.
  //          * If true, add in the postman collection. If false ignore the request.
  //          */
  //         if (!includeDeprecated && data.deprecated) {
  //           return;
  //         }

  //         // join till the last path i.e. the folder.
  //         let previousPathIdentified = pathSplit.slice(0, (pathSplit.length)).join('/'),
  //           pathIdentifier = `${pathSplit.join('/')}:${method}`;

  //         tree.setNode(`path:${pathIdentifier}`, {
  //           type: 'request',
  //           data: {},
  //           meta: {
  //             path: path,
  //             method: method,
  //             pathIdentifier: pathIdentifier
  //           }
  //         });

  //         tree.setEdge(`path:${previousPathIdentified}`, `path:${pathIdentifier}`);
  //       });
  //     }
  //   });

  //   return tree;
  // },

  /**
   * Generates a skeleton tree structure for a Postman collection from an OpenAPI specification.
   * @example
   * generateSkeletionTreeFromOpenAPI(openapi, { includeDeprecated: true })
   * @param {Object} openapi - The OpenAPI specification object.
   * @param {Object} { includeDeprecated } - Optional parameter to include deprecated requests in the collection.
   * @returns {Object} Returns a tree structure representing the Postman collection.
   * @description
   *   - Creates folders for all the tags present in the OpenAPI specification.
   *   - Includes deprecated requests in the collection if specified.
   *   - References requests to their respective folders based on tags.
   *   - Ignores requests that are not allowed HTTP methods.
   */
  _generateTreeFromTags = function (openapi, { includeDeprecated }) {
    let tree = new Graph(),

      tagDescMap = _.reduce(openapi.tags, function (acc, data) {
        acc[data.name] = data.description;

        return acc;
      }, {});

    tree.setNode('root:collection', {
      type: 'collection',
      data: {},
      meta: {}
    });

    /**
     * Create folders for all the tags present.
     */
    _.forEach(tagDescMap, function (desc, tag) {
      if (tree.hasNode(`path:${tag}`)) {
        return;
      }

      /**
       * Generate a folder node and attach to root of collection.
       */
      tree.setNode(`path:${tag}`, {
        type: 'folder',
        meta: {
          path: '',
          name: tag,
          description: tagDescMap[tag]
        },
        data: {}
      });

      tree.setEdge('root:collection', `path:${tag}`);
    });

    _.forEach(openapi.paths, function (methods, path) {
      _.forEach(methods, function (data, method) {
        if (!ALLOWED_HTTP_METHODS[method]) {
          return;
        }

        /**
         * include deprecated handling.
         * If true, add in the postman collection. If false ignore the request.
         */
        if (!includeDeprecated && data.deprecated) {
          return;
        }

        /**
         * For all the tags present. Make that request to be
         * referenced in all the folder which are applicable.
         */
        if (data.tags && data.tags.length > 0) {
          _.forEach(data.tags, function (tag) {
            tree.setNode(`path:${tag}:${path}:${method}`, {
              type: 'request',
              data: {},
              meta: {
                tag: tag,
                path: path,
                method: method
              }
            });

            // safeguard just in case there is no folder created for this tag.
            if (!tree.hasNode(`path:${tag}`)) {
              tree.setNode(`path:${tag}`, {
                type: 'folder',
                meta: {
                  path: path,
                  name: tag,
                  description: tagDescMap[tag]
                },
                data: {}
              });

              tree.setEdge('root:collection', `path:${tag}`);
            }

            tree.setEdge(`path:${tag}`, `path:${tag}:${path}:${method}`);
          });
        }

        else {
          tree.setNode(`path:${path}:${method}`, {
            type: 'request',
            data: {},
            meta: {
              path: path,
              method: method
            }
          });

          tree.setEdge('root:collection', `path:${path}:${method}`);
        }
      });
    });

    return tree;
  },

  /**
   * Generates a skeleton tree from an OpenAPI object.
   * @example
   * generateSkeletonTreeFromOpenAPI(openapi, tree, { includeDeprecated: true })
   * @param {Object} openapi - The OpenAPI object to generate the tree from.
   * @param {Object} tree - The tree object to add the generated nodes and edges to.
   * @param {Object} options - Optional parameters for generating the tree.
   * @param {boolean} options.includeDeprecated - Flag to include deprecated requests in the tree.
   * @returns {Object} The generated tree object.
   * @description
   *   - Adds a 'webhook~folder' node to the tree if the OpenAPI object contains webhooks.
   *   - Adds a 'webhook~request' node for each webhook method to the tree.
   *   - Adds edges between the 'webhook~folder' node and each 'webhook~request' node.
   *   - If 'includeDeprecated' is false, ignores any deprecated requests.
   */
  _generateWebhookEndpoints = function (openapi, tree, { includeDeprecated }) {
    if (!_.isEmpty(openapi.webhooks)) {
      tree.setNode(`${PATH_WEBHOOK}:folder`, {
        type: 'webhook~folder',
        meta: {
          path: 'webhook~folder',
          name: 'webhook~folder',
          description: ''
        },
        data: {}
      });

      tree.setEdge('root:collection', `${PATH_WEBHOOK}:folder`);
    }

    _.forEach(openapi.webhooks, function (methodData, path) {
      _.forEach(methodData, function (data, method) {
        /**
         * include deprecated handling.
         * If true, add in the postman collection. If false ignore the request.
         */
        if (!includeDeprecated && data.deprecated) {
          return;
        }

        tree.setNode(`${PATH_WEBHOOK}:${path}:${method}`, {
          type: 'webhook~request',
          meta: { path: path, method: method },
          data: {}
        });

        tree.setEdge(`${PATH_WEBHOOK}:folder`, `${PATH_WEBHOOK}:${path}:${method}`);
      });
    });

    return tree;
  };

/**
 * Used to generate a tree skeleton for the openapi which will be a collection
 *
 * @param  {Object} openapi - openapi schema paths in question
 * @param  {String} stratergy='PATHS'
 *
 * @returns {Object} - tree format
 */
module.exports = function (openapi, { folderStrategy, includeWebhooks, includeDeprecated }) {
  let skeletonTree;

  switch (folderStrategy) {
    case 'tags':
      skeletonTree = _generateTreeFromTags(openapi, { includeDeprecated });
      break;

    case 'paths':
      skeletonTree = _generateTreeFromPathsV2(openapi, { includeDeprecated });
      break;

    default:
      throw new Error('generateSkeletonTreeFromOpenAPI~folderStrategy not valid');
  }

  if (includeWebhooks) {
    skeletonTree = _generateWebhookEndpoints(openapi, skeletonTree, { includeDeprecated });
  }

  return skeletonTree;
};
