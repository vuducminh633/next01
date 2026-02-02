#define _USE_MATH_DEFINES
#include <math.h>
#include <stdlib.h>
#include <emscripten.h>

#ifndef EMSCRIPTEN_KEEPALIVE
  #define EMSCRIPTEN_KEEPALIVE
#endif

// 1. Structure to return data to JavaScript
// We pack the pointer and the size together
typedef struct {
    float* vertices; // Array of [x, y, z, x, y, z...]
    int count;       // Number of floats
} MeshResult;

// Global pointer to keep track of memory (simple version)
float* result_buffer = NULL;

// Helper: Clean up old memory before new calculation
void reset_buffer(int size) {
    if (result_buffer) free(result_buffer);
    result_buffer = (float*)malloc(size * sizeof(float));
}

// ---------------------------------------------------------
// FUNCTION 1: Convert Circle -> Line Segments (Mesh)
// ---------------------------------------------------------
EMSCRIPTEN_KEEPALIVE
float* generate_circle_mesh(float cx, float cy, float radius, int segments) {
    // We need 3 floats (x,y,z) per point, and (segments + 1) points to close the loop
    int total_floats = (segments + 1) * 3; 
    reset_buffer(total_floats);

    for (int i = 0; i <= segments; i++) {
        // Calculate Angle: 0 to 2*PI
        float theta = 2.0f * M_PI * ((float)i / segments);

        // Math: x = r*cos(theta), y = r*sin(theta)
        float x = cx + radius * cosf(theta);
        float y = cy + radius * sinf(theta);
        
        // Store in buffer [x, y, z]
        result_buffer[i*3 + 0] = x;
        result_buffer[i*3 + 1] = y;
        result_buffer[i*3 + 2] = 0.0f; // Z is flat
    }

    return result_buffer; 
}

// ---------------------------------------------------------
// FUNCTION 2: Convert Arc -> Line Segments
// ---------------------------------------------------------
EMSCRIPTEN_KEEPALIVE
float* generate_arc_mesh(float cx, float cy, float radius, float startAngle, float endAngle, int segments) {
    int total_floats = (segments + 1) * 3;
    reset_buffer(total_floats);

    // Calculate the span of the arc
    float totalAngle = endAngle - startAngle;

    for (int i = 0; i <= segments; i++) {
        // Interpolate current angle
        float theta = startAngle + totalAngle * ((float)i / segments);

        float x = cx + radius * cosf(theta);
        float y = cy + radius * sinf(theta);

        result_buffer[i*3 + 0] = x;
        result_buffer[i*3 + 1] = y;
        result_buffer[i*3 + 2] = 0.0f;
    }

    return result_buffer;
}

// Helper to get the buffer size from JS
EMSCRIPTEN_KEEPALIVE
int get_last_count(int segments) {
    return (segments + 1) * 3;
}