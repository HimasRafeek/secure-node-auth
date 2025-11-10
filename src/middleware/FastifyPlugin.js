const fp = require('fastify-plugin');

/**
 * Fastify plugin for SecureNodeAuth
 * Provides easy integration with Fastify framework
 */
async function secureNodeAuthPlugin(fastify, options) {
  const { authInstance, routeOptions = {} } = options;

  if (!authInstance) {
    throw new Error('authInstance is required for SecureNodeAuth Fastify plugin');
  }

  // Decorate fastify instance with auth
  fastify.decorate('auth', authInstance);

  // Add auth decorator for routes (preHandler)
  fastify.decorate('authenticate', async function(request, reply) {
    try {
      const authHeader = request.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.code(401).send({
          success: false,
          error: 'No token provided'
        });
      }

      const token = authHeader.substring(7);
      const decoded = await authInstance.verifyAccessToken(token);
      
      // Attach user to request
      request.user = decoded;
    } catch (error) {
      return reply.code(401).send({
        success: false,
        error: 'Invalid or expired token'
      });
    }
  });

  // Register auth routes if enabled
  if (routeOptions.registerRoutes !== false) {
    const FastifyRoutes = require('./FastifyRoutes');
    const routes = new FastifyRoutes(authInstance, routeOptions);
    
    await fastify.register(
      async (fastifyInstance) => {
        await routes.register(fastifyInstance, routeOptions);
      },
      { prefix: routeOptions.prefix || '/auth' }
    );
  }
}

module.exports = fp(secureNodeAuthPlugin, {
  fastify: '4.x',
  name: 'secure-node-auth'
});
