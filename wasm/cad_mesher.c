#define _USE_MATH_DEFINES
#include <math.h>
#include <stdlib.h>
#include <emscripten.h>

#ifndef EMSCRIPTEN_KEEPALIVE
  #define EMSCRIPTEN_KEEPALIVE
#endif

// Global pointer to keep track of memory
float* result_buffer = NULL;

void reset_buffer(int size) {
    if (result_buffer) free(result_buffer);
    result_buffer = (float*)malloc(size * sizeof(float));
}

// Convert Circle -> 2D Line Segments
EMSCRIPTEN_KEEPALIVE
float* generate_circle_mesh(float cx, float cy, float radius, int segments) {
    int total_floats = (segments + 1) * 2; 
    reset_buffer(total_floats);

    for (int i = 0; i <= segments; i++) {
        float theta = 2.0f * M_PI * ((float)i / segments);
        
        float x = cx + radius * cosf(theta);
        float y = cy + radius * sinf(theta);
        
        result_buffer[i*2 + 0] = x;
        result_buffer[i*2 + 1] = y;
    }

    return result_buffer; 
}

// ---------------------------------------------------------
// Convert Arc -> 2D Line Segments
// ---------------------------------------------------------
EMSCRIPTEN_KEEPALIVE
float* generate_arc_mesh(float cx, float cy, float radius, float startAngle, float endAngle, int segments) {
    int total_floats = (segments + 1) * 2;
    reset_buffer(total_floats);

    float totalAngle = endAngle - startAngle;

    for (int i = 0; i <= segments; i++) {
        float theta = startAngle + totalAngle * ((float)i / segments);

        float x = cx + radius * cosf(theta);
        float y = cy + radius * sinf(theta);

        // CHANGE: Store [x, y] only. Stride is 2.
        result_buffer[i*2 + 0] = x;
        result_buffer[i*2 + 1] = y;
    }

    return result_buffer;
}

EMSCRIPTEN_KEEPALIVE
int get_last_count(int segments) {
    return (segments + 1) * 2;
}